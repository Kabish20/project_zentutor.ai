"""AI teacher regression tests. All provider requests use local mocks."""
import asyncio
from concurrent.futures import ThreadPoolExecutor
import json
import os
import threading
import unittest
from unittest.mock import AsyncMock, patch

import httpx
from fastapi.testclient import TestClient

# Share the suite's isolated temporary database; never import main against user data.
from test_app import main
from app import teacher


API_KEY = 'sk-test-private-teacher-key'
REAL_ASYNC_CLIENT = httpx.AsyncClient


class TeacherApiTests(unittest.TestCase):
    counter = 0

    def setUp(self):
        TeacherApiTests.counter += 1
        main.limits.clear()
        teacher.connections.clear()
        teacher.active_turns.clear()
        self.environment = patch.dict(os.environ, {'OPENAI_API_KEY': '', 'OPENAI_MODEL': ''})
        self.environment.start()
        self.addCleanup(self.environment.stop)
        self.client = TestClient(main.app)
        self.addCleanup(self.client.close)
        self.credentials = {'username': f'teacher{self.counter}', 'password': 'teacher-test-password', 'name': 'Learner'}
        response = self.client.post('/api/auth/register', json=self.credentials)
        self.assertEqual(response.status_code, 201)
        self.user_id = response.json()['id']

    def connect(self, client=None):
        client = client or self.client
        with patch.object(teacher, 'validate_connection', new=AsyncMock()) as validate:
            response = client.post('/api/teacher/connect', json={'api_key': API_KEY, 'model': teacher.DEFAULT_MODEL})
        self.assertEqual(response.status_code, 200, response.text)
        validate.assert_awaited_once()
        return response

    def conversation(self, client=None):
        response = (client or self.client).post('/api/teacher/conversations', json={})
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()['id']

    def send(self, conversation_id, message='Explain transformers', **extra):
        return self.client.post(f'/api/teacher/conversations/{conversation_id}/messages', json={'message': message, **extra})

    def messages(self, conversation_id):
        response = self.client.get(f'/api/teacher/conversations/{conversation_id}')
        self.assertEqual(response.status_code, 200)
        return response.json()['messages']

    def events(self, response):
        self.assertEqual(response.status_code, 200, response.text)
        self.assertIn('application/x-ndjson', response.headers['content-type'])
        return [json.loads(line) for line in response.text.splitlines() if line]

    def test_authentication_and_user_conversation_isolation(self):
        self.connect()
        conversation_id = self.conversation()
        private_preferences = {'level': 'advanced', 'style': 'concise', 'language': 'Tamil + English'}
        self.assertEqual(self.client.put('/api/teacher/settings', json=private_preferences).status_code, 200)
        with TestClient(main.app) as other:
            self.assertEqual(other.get('/api/teacher/settings').status_code, 401)
            self.assertEqual(other.get('/api/teacher/conversations').status_code, 401)
            self.assertEqual(other.post('/api/teacher/conversations', json={}).status_code, 401)
            self.assertEqual(other.post('/api/auth/register', json={**self.credentials, 'username': self.credentials['username'] + 'other'}).status_code, 201)
            self.assertFalse(other.get('/api/teacher/settings').json()['configured'])
            self.assertEqual(other.get('/api/teacher/settings').json()['preferences']['level'], 'beginner')
            self.assertEqual(other.get('/api/teacher/conversations').json(), [])
            self.assertEqual(other.get(f'/api/teacher/conversations/{conversation_id}').status_code, 404)
            self.assertEqual(other.post(f'/api/teacher/conversations/{conversation_id}/messages', json={'message': 'Read their history'}).status_code, 404)
        self.assertEqual(self.messages(conversation_id), [])

    def test_conversation_can_be_deleted_with_its_messages(self):
        self.connect()
        conversation_id = self.conversation()

        async def answer(connection, instructions, inputs):
            yield 'Saved answer.'

        with patch.object(teacher, 'stream_answer', new=answer):
            self.events(self.send(conversation_id, 'Keep this private'))
        response = self.client.request('DELETE', f'/api/teacher/conversations/{conversation_id}', json={})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), {'deleted': conversation_id})
        self.assertEqual(self.client.get('/api/teacher/conversations').json(), [])
        self.assertEqual(self.client.get(f'/api/teacher/conversations/{conversation_id}').status_code, 404)

    def test_connection_key_is_session_only_and_signout_discards_it(self):
        response = self.connect()
        self.assertTrue(response.json()['configured'])
        self.assertEqual(response.json()['connection_source'], 'session')
        settings = self.client.get('/api/teacher/settings')
        self.assertNotIn(API_KEY, response.text + settings.text)
        self.assertNotIn('api_key', response.json())
        with main.database() as db:
            self.assertNotIn(API_KEY, '\n'.join(db.iterdump()))
        token_digest = main.token_hash(self.client.cookies.get(main.COOKIE))
        self.assertIn(token_digest, teacher.connections)
        with TestClient(main.app) as same_user:
            self.assertEqual(same_user.post('/api/auth/login', json=self.credentials).status_code, 200)
            self.assertFalse(same_user.get('/api/teacher/settings').json()['configured'])
        self.assertEqual(self.client.post('/api/auth/logout', json={}).status_code, 200)
        self.assertNotIn(token_digest, teacher.connections)
        self.assertEqual(self.client.post('/api/auth/login', json=self.credentials).status_code, 200)
        self.assertFalse(self.client.get('/api/teacher/settings').json()['configured'])

    def test_disconnect_disables_environment_fallback_for_that_session(self):
        with patch.dict(os.environ, {'OPENAI_API_KEY': API_KEY, 'OPENAI_MODEL': 'environment-model'}):
            settings = self.client.get('/api/teacher/settings').json()
            self.assertEqual(settings['connection_source'], 'environment')
            self.assertEqual(settings['model'], 'environment-model')
            response = self.client.request('DELETE', '/api/teacher/connection', json={})
            self.assertEqual(response.status_code, 200)
            self.assertFalse(response.json()['configured'])
            self.assertFalse(self.client.get('/api/teacher/settings').json()['configured'])
            with TestClient(main.app) as same_user:
                same_user.post('/api/auth/login', json=self.credentials)
                self.assertTrue(same_user.get('/api/teacher/settings').json()['configured'])

    def test_invalid_connection_does_not_replace_working_key(self):
        self.connect()
        with patch.object(teacher, 'validate_connection', new=AsyncMock(side_effect=teacher.ProviderError('OpenAI did not accept this API key.'))):
            response = self.client.post('/api/teacher/connect', json={'api_key': 'sk-rejected-private-key', 'model': 'other-model'})
        self.assertEqual(response.status_code, 400)
        self.assertNotIn('sk-rejected-private-key', response.text)
        digest = main.token_hash(self.client.cookies.get(main.COOKIE))
        self.assertEqual(teacher.connections[digest].api_key, API_KEY)
        self.assertEqual(self.client.get('/api/teacher/settings').json()['model'], teacher.DEFAULT_MODEL)

    def test_missing_key_cannot_create_fake_answer_or_message(self):
        conversation_id = self.conversation()
        with patch.object(teacher, 'stream_answer') as provider:
            response = self.send(conversation_id)
        self.assertEqual(response.status_code, 409)
        self.assertIn('Connect OpenAI', response.json()['detail'])
        provider.assert_not_called()
        self.assertEqual(self.messages(conversation_id), [])

    def test_streaming_answer_persists_followups_and_separates_threads(self):
        self.connect()
        first, second = self.conversation(), self.conversation()
        captured = []

        async def answer(connection, instructions, inputs):
            captured.append(inputs)
            yield 'Attention weighs '
            yield 'relevant tokens.'

        with patch.object(teacher, 'stream_answer', new=answer):
            events = self.events(self.send(first, 'Explain transformer attention'))
            self.events(self.send(second, 'How does Kubernetes deploy an ML API?'))
            self.events(self.send(first, 'Show the code'))
        self.assertEqual([item['type'] for item in events], ['start', 'delta', 'delta', 'done'])
        self.assertEqual(events[-1]['message']['content'], 'Attention weighs relevant tokens.')
        self.assertEqual(captured[0], [{'role': 'user', 'content': 'Explain transformer attention'}])
        self.assertEqual(captured[1], [{'role': 'user', 'content': 'How does Kubernetes deploy an ML API?'}])
        self.assertEqual(captured[2], [
            {'role': 'user', 'content': 'Explain transformer attention'},
            {'role': 'assistant', 'content': 'Attention weighs relevant tokens.'},
            {'role': 'user', 'content': 'Show the code'},
        ])
        with TestClient(main.app) as reopened:
            reopened.post('/api/auth/login', json=self.credentials)
            messages = reopened.get(f'/api/teacher/conversations/{first}').json()['messages']
            self.assertEqual(len(messages), 4)
            self.assertTrue(all(item['status'] == 'complete' for item in messages))
            self.assertEqual(len(reopened.get('/api/teacher/conversations').json()), 2)
        self.assertEqual(self.client.get('/api/dashboard').json()['mastered'], 0)
        self.assertEqual(teacher.active_turns, set())

    def test_failed_and_interrupted_answers_can_retry_without_invented_content(self):
        self.connect()
        for partial in ('', 'An unfinished explanation'):
            with self.subTest(partial=partial):
                conversation_id = self.conversation()

                async def failure(connection, instructions, inputs):
                    if partial:
                        yield partial
                    raise teacher.ProviderError('The connection ended before the answer finished. Please retry.')

                with patch.object(teacher, 'stream_answer', new=failure):
                    events = self.events(self.send(conversation_id))
                self.assertEqual(events[-1]['type'], 'error')
                self.assertNotIn('done', [item['type'] for item in events])
                failed = self.messages(conversation_id)[-1]
                self.assertEqual(failed['content'], partial)
                self.assertEqual(failed['status'], 'interrupted' if partial else 'error')
                self.assertEqual(teacher.active_turns, set())
                captured = []

                async def retry(connection, instructions, inputs):
                    captured.extend(inputs)
                    yield 'Transformers use attention to relate tokens.'

                with patch.object(teacher, 'stream_answer', new=retry):
                    retried = self.events(self.send(conversation_id, 'Please retry'))
                self.assertEqual(retried[-1]['type'], 'done')
                self.assertFalse(any(row['role'] == 'assistant' for row in captured))
                self.assertEqual(len(self.messages(conversation_id)), 4)

    def test_preferences_and_broad_question_reach_answer_first_teacher(self):
        self.connect()
        preferences = {'level': 'advanced', 'style': 'step_by_step', 'language': 'Tamil + English'}
        self.assertEqual(self.client.put('/api/teacher/settings', json=preferences).json()['preferences'], preferences)
        calls = []

        async def answer(connection, instructions, inputs):
            calls.append((instructions, inputs))
            yield 'Here is the explanation.'

        prompts = ['Explain LoRA fine-tuning and its matrix dimensions', 'Design an ML feature store for real-time inference']
        with patch.object(teacher, 'stream_answer', new=answer):
            for prompt in prompts:
                self.assertEqual(self.events(self.send(self.conversation(), prompt))[-1]['type'], 'done')
        for (instructions, inputs), prompt in zip(calls, prompts):
            self.assertEqual(inputs[-1]['content'], prompt)
            self.assertIn('Answer the actual question immediately', instructions)
            self.assertIn('Do not gate the answer behind a diagnostic quiz', instructions)
            self.assertIn('Teaching level: advanced', instructions)
            self.assertIn('Explanation style: step_by_step', instructions)
            self.assertIn('Language: Tamil + English', instructions)
            self.assertIn('MLOps', instructions)
            self.assertIn('You have no execution or web tools', instructions)

    def test_input_guards_do_not_append_messages(self):
        self.connect()
        conversation_id = self.conversation()
        for body in ({'message': ' '}, {'message': 'x' * 12001}, {'message': 'Explain', 'mode': 'unknown'}):
            with self.subTest(body=str(body)[:80]):
                response = self.client.post(f'/api/teacher/conversations/{conversation_id}/messages', json=body)
                self.assertEqual(response.status_code, 422)
        self.assertEqual(self.send(conversation_id, lesson_id='missing-lesson').status_code, 404)
        self.assertEqual(self.client.put('/api/teacher/settings', json={'level': 'expert'}).status_code, 422)
        self.assertEqual(self.client.post('/api/teacher/connect', json={'api_key': 'tiny'}).status_code, 422)
        self.assertEqual(self.messages(conversation_id), [])

    def test_concurrent_message_is_rejected_and_lock_released(self):
        self.connect()
        conversation_id = self.conversation()
        entered, release = threading.Event(), threading.Event()

        async def delayed_answer(connection, instructions, inputs):
            entered.set()
            while not release.is_set():
                await asyncio.sleep(0.01)
            yield 'The completed first answer.'

        with TestClient(main.app) as concurrent_client:
            concurrent_client.cookies.update(self.client.cookies)
            with patch.object(teacher, 'stream_answer', new=delayed_answer), ThreadPoolExecutor(max_workers=1) as pool:
                first = pool.submit(self.send, conversation_id)
                try:
                    self.assertTrue(entered.wait(5), 'First answer did not start')
                    overlapping = concurrent_client.post(f'/api/teacher/conversations/{conversation_id}/messages', json={'message': 'Overlapping question'})
                    self.assertEqual(overlapping.status_code, 409)
                    self.assertIn('still being generated', overlapping.json()['detail'])
                finally:
                    release.set()
                self.assertEqual(self.events(first.result(timeout=5))[-1]['type'], 'done')
        self.assertEqual(len(self.messages(conversation_id)), 2)
        self.assertEqual(teacher.active_turns, set())


class TeacherProviderTests(unittest.IsolatedAsyncioTestCase):
    def provider(self, handler):
        transport = httpx.MockTransport(handler)
        return patch.object(teacher.httpx, 'AsyncClient', side_effect=lambda **kwargs: REAL_ASYNC_CLIENT(transport=transport, **kwargs))

    def sse(self, *events):
        return ''.join('data: ' + json.dumps(event) + '\n\n' for event in events)

    async def collect(self, **kwargs):
        connection = teacher.Connection(API_KEY, kwargs.get('model', teacher.DEFAULT_MODEL), 'session')
        return [part async for part in teacher.stream_answer(connection, 'Teach clearly.', [{'role': 'user', 'content': 'Explain attention'}])]

    async def test_chunked_text_and_refusal_require_completed_event(self):
        requests = []
        payload = self.sse(
            {'type': 'response.created'},
            {'type': 'response.output_text.delta', 'delta': 'Attention '},
            {'type': 'response.output_text.delta', 'delta': 'connects tokens.'},
            {'type': 'response.completed', 'response': {'status': 'completed'}},
        )

        class Chunks(httpx.AsyncByteStream):
            async def __aiter__(self):
                encoded = payload.encode()
                for index in range(0, len(encoded), 7):
                    yield encoded[index:index + 7]

        def respond(request):
            requests.append(request)
            return httpx.Response(200, stream=Chunks())

        with self.provider(respond):
            self.assertEqual(await self.collect(), ['Attention ', 'connects tokens.'])
        request = requests[0]
        self.assertEqual(str(request.url), 'https://api.openai.com/v1/responses')
        sent = json.loads(request.content)
        self.assertFalse(sent['store'])
        self.assertTrue(sent['stream'])
        self.assertEqual(sent['input'][-1]['content'], 'Explain attention')
        self.assertEqual(request.headers['Authorization'], f'Bearer {API_KEY}')
        self.assertNotIn(API_KEY, request.content.decode())
        refusal = self.sse({'type': 'response.refusal.delta', 'delta': 'I cannot help with that request.'},
                           {'type': 'response.completed', 'response': {'status': 'completed'}})
        with self.provider(lambda request: httpx.Response(200, text=refusal)):
            self.assertEqual(await self.collect(), ['I cannot help with that request.'])

    async def test_incomplete_failed_malformed_and_early_eof_are_errors(self):
        cases = [
            (self.sse({'type': 'response.output_text.delta', 'delta': 'Partial'}), 'ended before'),
            ('data: [DONE]\n\n', 'ended before'),
            (self.sse({'type': 'response.incomplete'}), 'response limit'),
            (self.sse({'type': 'response.failed'}), 'could not finish'),
            (self.sse({'type': 'error'}), 'could not finish'),
            ('data: {not-valid-json}\n\n', 'interrupted'),
            (self.sse({'type': 'response.completed', 'response': {'status': 'incomplete'}}), 'ended before'),
        ]
        for payload, expected in cases:
            with self.subTest(expected=expected, payload=payload):
                with self.provider(lambda request: httpx.Response(200, text=payload)):
                    with self.assertRaisesRegex(teacher.ProviderError, expected):
                        await self.collect()

    async def test_provider_errors_never_return_payload_or_key(self):
        cases = [(401, '', 'did not accept'), (403, '', 'permission'), (404, '', 'unavailable'),
                 (429, 'insufficient_quota', 'no available quota'), (429, '', 'limiting requests'),
                 (400, '', 'selected model'), (500, '', 'temporarily unavailable')]
        for status, code, expected in cases:
            with self.subTest(status=status, code=code):
                with self.provider(lambda request: httpx.Response(status, json={'error': {'code': code, 'message': API_KEY}})):
                    with self.assertRaises(teacher.ProviderError) as caught:
                        await self.collect()
                self.assertIn(expected, str(caught.exception))
                self.assertNotIn(API_KEY, str(caught.exception))

    async def test_timeout_and_network_error_have_safe_retry_messages(self):
        for error, expected in [(httpx.ReadTimeout(API_KEY), 'too long'), (httpx.ConnectError(API_KEY), 'interrupted')]:
            with self.subTest(error=type(error).__name__):
                def fail(request):
                    raise error
                with self.provider(fail):
                    with self.assertRaises(teacher.ProviderError) as caught:
                        await self.collect()
                self.assertIn(expected, str(caught.exception))
                self.assertNotIn(API_KEY, str(caught.exception))

    async def test_validate_connection_checks_model_without_generating_answer(self):
        requests = []

        def respond(request):
            requests.append(request)
            return httpx.Response(200, json={'id': 'custom-model'})

        with self.provider(respond):
            await teacher.validate_connection(teacher.Connection(API_KEY, 'custom-model', 'session'))
        self.assertEqual(len(requests), 1)
        self.assertEqual(requests[0].method, 'GET')
        self.assertEqual(str(requests[0].url), 'https://api.openai.com/v1/models/custom-model')
        with self.provider(lambda request: httpx.Response(200, json={'id': 'different-model'})):
            with self.assertRaisesRegex(teacher.ProviderError, 'unexpected model record'):
                await teacher.validate_connection(teacher.Connection(API_KEY, 'custom-model', 'session'))


class TeacherContextTests(unittest.TestCase):
    def test_history_budget_excludes_partial_answers_and_orphaned_assistant(self):
        history = [
            {'role': 'user', 'content': 'Old question that does not fit', 'status': 'complete'},
            {'role': 'assistant', 'content': 'Old answer', 'status': 'complete'},
            {'role': 'user', 'content': 'Why?', 'status': 'complete'},
            {'role': 'assistant', 'content': 'Because', 'status': 'complete'},
            {'role': 'assistant', 'content': 'Unfinished secret fragment', 'status': 'interrupted'},
            {'role': 'assistant', 'content': '', 'status': 'error'},
        ]
        selected = teacher.provider_inputs(history, 'Code?', max_chars=28)
        self.assertEqual(selected, [{'role': 'user', 'content': 'Why?'}, {'role': 'assistant', 'content': 'Because'}, {'role': 'user', 'content': 'Code?'}])
        self.assertLessEqual(sum(len(item['content']) for item in selected), 28)

    def test_teaching_modes_keep_code_review_and_practice_expectations(self):
        preferences = teacher.Preferences()
        self.assertIn('one step at a time', teacher.teaching_instructions(preferences, 'guided', []))
        self.assertIn('hints before a solution', teacher.teaching_instructions(preferences, 'practice', []))
        self.assertIn('one interview question at a time', teacher.teaching_instructions(preferences, 'interview', []))
        self.assertIn('Never claim you ran their code', teacher.teaching_instructions(preferences, 'review', []))


if __name__ == '__main__':
    unittest.main()
