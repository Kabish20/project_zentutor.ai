import json
import os
import tempfile
import unittest
from datetime import timedelta
from pathlib import Path
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
import httpx

TEMP = tempfile.TemporaryDirectory()
os.environ['MENTOR_DB'] = str(Path(TEMP.name) / 'mentor-test.db')
os.environ['MENTOR_DISABLE_LOCAL_CONFIG'] = '1'
os.environ.pop('GEMINI_API_KEY', None)
os.environ.pop('GEMINI_MODEL', None)
os.environ.pop('AI_PROVIDER', None)
os.environ.pop('OPENAI_API_KEY', None)
os.environ.pop('OPENAI_MODEL', None)
from app import main
from app.curriculum import LESSONS, WEEKS, retrieve


class MentorTests(unittest.TestCase):
    counter = 0

    def setUp(self):
        MentorTests.counter += 1
        main.limits.clear()
        self.client = TestClient(main.app)
        self.username = f'learner{self.counter}'
        self.credentials = {'username': self.username, 'password': 'safe-test-password', 'name': 'Test Learner'}
        self.assertEqual(self.client.post('/api/auth/register', json=self.credentials).status_code, 201)
        self.lesson = LESSONS[0]

    def tearDown(self):
        self.client.close()

    def answers(self, correct=True):
        return {q['id']: q['correct'] if correct else (q['correct'] + 1) % len(q['options']) for q in self.lesson['questions']}

    def test_login_logout_and_password_storage(self):
        original = self.client.cookies.get(main.COOKIE)
        self.assertTrue(original)
        with main.database() as db:
            stored = db.execute('SELECT password FROM users WHERE username=?', (self.username,)).fetchone()['password']
            self.assertNotEqual(stored, self.credentials['password'])
            self.assertIsNone(db.execute('SELECT token FROM sessions WHERE token=?', (original,)).fetchone())
        self.client.post('/api/auth/logout', json={})
        self.assertEqual(self.client.get('/api/dashboard').status_code, 401)
        self.client.cookies.set(main.COOKIE, original)
        self.assertEqual(self.client.get('/api/dashboard').status_code, 401)
        self.client.cookies.clear()
        self.assertEqual(self.client.post('/api/auth/login', json={**self.credentials, 'password': 'wrong-password'}).status_code, 401)
        result = self.client.post('/api/auth/login', json=self.credentials)
        self.assertEqual(result.status_code, 200)
        self.assertIn('HttpOnly', result.headers['set-cookie'])
        self.assertIn('SameSite=strict', result.headers['set-cookie'])
        self.assertEqual(self.client.get('/api/auth/me').json()['username'], self.username)

    def test_expired_session_and_duplicate_registration(self):
        self.assertEqual(self.client.post('/api/auth/register', json=self.credentials).status_code, 409)
        with main.database() as db:
            db.execute('UPDATE sessions SET expires=? WHERE token=?', ((main.now() - timedelta(days=1)).isoformat(), main.token_hash(self.client.cookies.get(main.COOKIE))))
        self.assertEqual(self.client.get('/api/dashboard').status_code, 401)

    def test_curriculum_complete_without_answer_keys(self):
        result = self.client.get('/api/curriculum')
        self.assertEqual(result.status_code, 200)
        payload = result.json()
        self.assertEqual(len(payload['weeks']), 4)
        self.assertEqual(len(payload['lessons']), 12)
        for lesson in payload['lessons']:
            self.assertEqual(len(lesson['questions']), 3)
            self.assertTrue(lesson['objective'] and lesson['exercise'] and lesson['example'])
            for question in lesson['questions']:
                self.assertNotIn('correct', question)
                self.assertNotIn('explanation', question)
        self.assertNotIn('resume.txt', json.dumps(payload).lower())
        self.assertNotIn('15+ APIs', json.dumps(payload))
        self.assertEqual({week['week'] for week in WEEKS}, {1, 2, 3, 4})

    def test_grade_review_and_latest_evidence(self):
        url = f'/api/lessons/{self.lesson["id"]}/quiz'
        first = self.client.post(url, json={'answers': self.answers()}).json()
        self.assertEqual(first['score'], 100)
        self.assertEqual(first['status'], 'mastered')
        self.assertEqual(len(first['results']), 3)
        dashboard = self.client.get('/api/dashboard').json()
        self.assertEqual(dashboard['mastered'], 1)
        self.assertNotEqual(dashboard['recommended_lesson'], self.lesson['id'])
        second = self.client.post(url, json={'answers': self.answers(False)}).json()
        self.assertEqual(second['score'], 0)
        self.assertEqual(second['status'], 'needs_review')
        row = self.client.get('/api/dashboard').json()['progress'][0]
        self.assertEqual(row['attempts'], 2)
        self.assertEqual(row['status'], 'needs_review')
        with main.database() as db:
            db.execute('UPDATE progress SET next_review=? WHERE lesson_id=?', ((main.now() - timedelta(days=1)).isoformat(), self.lesson['id']))
        self.assertTrue(self.client.get('/api/dashboard').json()['progress'][0]['review_due'])

    def test_invalid_quizzes_cannot_mutate_progress(self):
        url = f'/api/lessons/{self.lesson["id"]}/quiz'
        for answers in [{}, {'fake': 0}, {k: 99 for k in self.answers()}, {k: True for k in self.answers()}, {k: '0' for k in self.answers()}]:
            self.assertEqual(self.client.post(url, json={'answers': answers}).status_code, 422)
        self.assertEqual(self.client.get('/api/dashboard').json()['progress'][0]['attempts'], 0)
        self.assertEqual(self.client.post('/api/lessons/missing/quiz', json={'answers': {}}).status_code, 404)

    def test_accounts_do_not_share_progress_messages_tasks_or_practice(self):
        lesson_id = self.lesson['id']
        self.client.post(f'/api/lessons/{lesson_id}/quiz', json={'answers': self.answers()})
        self.client.post(f'/api/lessons/{lesson_id}/chat', json={'message': 'My private question'})
        self.client.post(f'/api/lessons/{lesson_id}/practice', json={'submission': 'my_private_work = 1'})
        self.client.put('/api/weeks/1/tasks/0', json={'done': True, 'evidence': 'private-report.md'})
        other = TestClient(main.app)
        other.post('/api/auth/register', json={**self.credentials, 'username': self.username + 'other'})
        payload = other.get('/api/dashboard').json()
        self.assertEqual(payload['mastered'], 0)
        self.assertFalse(any(task['done'] for task in payload['tasks']))
        self.assertEqual(other.get(f'/api/lessons/{lesson_id}/messages').json(), [])
        self.assertEqual(other.get(f'/api/lessons/{lesson_id}/practice').json(), [])
        other.close()

    def test_practice_is_never_executed_and_never_grants_mastery(self):
        marker = Path(TEMP.name) / 'must-not-exist'
        code = f'from pathlib import Path\nPath({str(marker)!r}).write_text("unsafe")'
        reply = self.client.post(f'/api/lessons/{self.lesson["id"]}/practice', json={'submission': code})
        self.assertEqual(reply.status_code, 200)
        self.assertFalse(marker.exists())
        self.assertIn('not executed', ' '.join(reply.json()['feedback']))
        self.assertEqual(self.client.get('/api/dashboard').json()['mastered'], 0)
        bad = self.client.post(f'/api/lessons/{self.lesson["id"]}/practice', json={'submission': 'def broken(:'})
        self.assertIn('could not be parsed', ' '.join(bad.json()['feedback']))

    def test_tasks_require_evidence_and_remain_self_reported(self):
        self.assertEqual(self.client.put('/api/weeks/1/tasks/0', json={'done': True, 'evidence': ' '}).status_code, 422)
        response = self.client.put('/api/weeks/1/tasks/0', json={'done': True, 'evidence': 'report.md, 3 edge cases checked'})
        self.assertEqual(response.json()['verification'], 'self_reported')
        self.assertEqual(self.client.get('/api/dashboard').json()['mastered'], 0)
        self.assertEqual(self.client.put('/api/weeks/8/tasks/0', json={'done': False}).status_code, 404)

    def test_offline_tutor_diagnoses_and_cites_known_context(self):
        url = f'/api/lessons/{self.lesson["id"]}/chat'
        first = self.client.post(url, json={'message': 'Teach me'}).json()
        self.assertEqual(first['follow_up'], self.lesson['diagnostic'])
        self.assertEqual(first['example'], '')
        self.assertEqual(first['mode'], 'offline')
        second = self.client.post(url, json={'message': 'I would validate the input'}).json()
        self.assertTrue(second['example'])
        self.assertEqual(second['sources'][0]['source_id'], 'roadmap-w1')
        for mode in ['practice', 'revision', 'interview']:
            self.assertEqual(self.client.post(url, json={'message': 'Help', 'mode': mode}).status_code, 200)
        self.assertEqual(len(self.client.get(url.replace('/chat', '/messages')).json()), 10)
        self.assertEqual(self.client.get('/api/dashboard').json()['mastered'], 0)

    def test_provider_failure_falls_back_without_exposing_secrets(self):
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'secret-test-key', 'OPENAI_MODEL': 'test-model'}), patch.object(main, 'hosted_reply', new=AsyncMock(side_effect=httpx.ConnectError('secret-test-key'))):
            response = self.client.post(f'/api/lessons/{self.lesson["id"]}/chat', json={'message': 'Teach me'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['mode'], 'offline')
        self.assertIn('could not return', response.json()['notice'])
        self.assertNotIn('secret-test-key', response.text)

    def test_hosted_adapter_validates_and_limits_context(self):
        reply = {'explanation': 'Consider the input.', 'example': '', 'practice': '', 'follow_up': 'What should happen?'}
        response = httpx.Response(200, json={'status': 'completed', 'output': [
            {'type': 'reasoning', 'summary': []},
            {'type': 'message', 'content': [{'type': 'output_text', 'text': json.dumps(reply)}]}]},
            request=httpx.Request('POST', 'https://api.openai.com/v1/responses'))
        fake = AsyncMock()
        fake.__aenter__.return_value = fake
        fake.post.return_value = response
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-key', 'OPENAI_MODEL': 'test-model'}), patch.object(main.httpx, 'AsyncClient', return_value=fake):
            result = self.client.post(f'/api/lessons/{self.lesson["id"]}/chat', json={'message': 'Teach Python'})
        self.assertEqual(result.json()['mode'], 'llm')
        payload = fake.post.call_args.kwargs['json']
        self.assertFalse(payload['store'])
        self.assertEqual(payload['model'], 'test-model')
        self.assertNotIn('correct_option', json.dumps(payload))
        self.assertNotIn(self.credentials['password'], json.dumps(payload))
        self.assertEqual(payload['input'][-1]['role'], 'user')

    def test_csrf_host_and_input_guards(self):
        url = f'/api/lessons/{self.lesson["id"]}/start'
        self.assertEqual(self.client.post(url, json={}, headers={'Origin': 'https://evil.example'}).status_code, 403)
        self.assertEqual(self.client.post(url, content='{}', headers={'Content-Type': 'text/plain'}).status_code, 415)
        self.assertEqual(self.client.get('/api/health', headers={'Host': 'evil.example'}).status_code, 400)
        self.assertEqual(self.client.post(f'/api/lessons/{self.lesson["id"]}/chat', json={'message': ' '}).status_code, 422)
        self.assertEqual(self.client.post(f'/api/lessons/{self.lesson["id"]}/chat', json={'message': 'x' * 4001}).status_code, 422)

    def test_retrieval_returns_relevant_known_lessons(self):
        results = retrieve('conditional probability Bayes base rates', 'probability')
        self.assertEqual(results[0]['id'], 'probability')
        self.assertLessEqual(len(results), 3)
        self.assertEqual(retrieve('qwertyzxy', self.lesson['id'])[0]['id'], self.lesson['id'])

    def test_frontend_and_api_health(self):
        self.assertEqual(self.client.get('/api/health').json()['status'], 'ok')
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('zentutor.ai', response.text)


if __name__ == '__main__':
    unittest.main()
