"""Gemini adapter and configuration regressions; only dummy credentials and mocks."""
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import AsyncMock, patch

import httpx
from fastapi.testclient import TestClient

# This import selects an isolated database and disables the real local config.
from test_app import main
from app import gemini, teacher
from app.curriculum import LESSONS


API_KEY = 'dummy-gemini-key-for-isolated-tests'
REAL_ASYNC_CLIENT = httpx.AsyncClient


class GeminiProviderTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.connection = teacher.Connection(API_KEY, 'gemini-2.5-flash', 'session', provider='gemini')

    def provider(self, handler):
        transport = httpx.MockTransport(handler)
        return patch.object(gemini.httpx, 'AsyncClient', side_effect=lambda **kwargs: REAL_ASYNC_CLIENT(transport=transport, **kwargs))

    @staticmethod
    def sse(*events):
        return ''.join('data: ' + json.dumps(event) + '\n\n' for event in events)

    async def collect(self):
        return [part async for part in teacher.stream_answer(self.connection, 'Teach clearly.', [
            {'role': 'user', 'content': 'Explain attention'},
            {'role': 'assistant', 'content': 'Attention relates tokens.'},
            {'role': 'user', 'content': 'Why?'},
            {'role': 'user', 'content': 'Show a small example.'},
        ])]

    async def test_model_validation_uses_header_and_checks_text_generation(self):
        requests = []

        def respond(request):
            requests.append(request)
            return httpx.Response(200, json={'name': 'models/gemini-2.5-flash', 'supportedGenerationMethods': ['generateContent']})

        with self.provider(respond):
            await teacher.validate_connection(self.connection)
        self.assertEqual(len(requests), 1)
        request = requests[0]
        self.assertEqual(request.method, 'GET')
        self.assertEqual(str(request.url), gemini.BASE_URL + '/gemini-2.5-flash')
        self.assertEqual(request.headers['x-goog-api-key'], API_KEY)
        self.assertNotIn(API_KEY, str(request.url))
        self.assertNotIn('authorization', request.headers)
        for record in (
            {'name': 'models/wrong-model', 'supportedGenerationMethods': ['generateContent']},
            {'name': 'models/gemini-2.5-flash', 'supportedGenerationMethods': ['embedContent']},
        ):
            with self.subTest(record=record), self.provider(lambda request: httpx.Response(200, json=record)):
                with self.assertRaisesRegex(teacher.ProviderError, 'supports text generation'):
                    await teacher.validate_connection(self.connection)

    async def test_chunked_stream_maps_history_and_omits_thought_parts(self):
        requests = []
        payload = self.sse(
            {'candidates': [{'content': {'parts': [{'thought': True, 'text': 'PRIVATE_THOUGHT'}, {'text': 'Attention '}]}}]},
            {'candidates': [{'content': {'parts': [{'text': 'weighs relevant tokens.'}]}, 'finishReason': 'STOP'}]},
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
            self.assertEqual(await self.collect(), ['Attention ', 'weighs relevant tokens.'])
        request = requests[0]
        self.assertEqual(request.method, 'POST')
        self.assertEqual(str(request.url), gemini.BASE_URL + '/gemini-2.5-flash:streamGenerateContent?alt=sse')
        self.assertEqual(request.headers['x-goog-api-key'], API_KEY)
        self.assertNotIn(API_KEY, str(request.url) + request.content.decode())
        sent = json.loads(request.content)
        self.assertEqual(sent['systemInstruction'], {'parts': [{'text': 'Teach clearly.'}]})
        self.assertEqual(sent['contents'], [
            {'role': 'user', 'parts': [{'text': 'Explain attention'}]},
            {'role': 'model', 'parts': [{'text': 'Attention relates tokens.'}]},
            {'role': 'user', 'parts': [{'text': 'Why?'}, {'text': 'Show a small example.'}]},
        ])

    async def test_stream_requires_stop_and_preserves_partial_text_on_truncation(self):
        observed = []
        payload = self.sse({'candidates': [{'content': {'parts': [{'text': 'A partial answer'}]}, 'finishReason': 'MAX_TOKENS'}]})
        with self.provider(lambda request: httpx.Response(200, text=payload)):
            with self.assertRaisesRegex(teacher.ProviderError, 'response limit'):
                async for part in gemini.stream_content(self.connection, 'Teach.', [{'role': 'user', 'content': 'Explain'}]):
                    observed.append(part)
        self.assertEqual(observed, ['A partial answer'])
        for payload in (self.sse({'candidates': [{'content': {'parts': [{'text': 'Unfinished'}]}}]}), self.sse({'usageMetadata': {}})):
            with self.subTest(payload=payload), self.provider(lambda request: httpx.Response(200, text=payload)):
                with self.assertRaisesRegex(teacher.ProviderError, 'ended before'):
                    await self.collect()

    async def test_blocked_and_malformed_streams_do_not_expose_provider_content(self):
        cases = [
            (self.sse({'promptFeedback': {'blockReason': 'SAFETY', 'blockReasonMessage': API_KEY}}), 'rephrasing'),
            (self.sse({'candidates': [{'content': {'parts': [{'text': API_KEY}]}, 'finishReason': 'SAFETY'}]}), 'rephrasing'),
            (self.sse({'error': {'message': API_KEY}}), 'could not finish'),
            ('data: invalid-json\n\n', 'interrupted'),
        ]
        for payload, expected in cases:
            with self.subTest(expected=expected), self.provider(lambda request: httpx.Response(200, text=payload)):
                with self.assertRaises(teacher.ProviderError) as caught:
                    await self.collect()
            self.assertIn(expected, str(caught.exception))
            self.assertNotIn(API_KEY, str(caught.exception))

    async def test_http_errors_are_actionable_without_forwarding_raw_errors(self):
        cases = [
            (400, 'API key not valid: ' + API_KEY, 'did not accept'),
            (403, 'Key reported as leaked: ' + API_KEY, 'replacement'),
            (403, API_KEY, 'permission'),
            (404, API_KEY, 'unavailable'),
            (429, API_KEY, 'quota'),
            (500, API_KEY, 'temporarily unavailable'),
        ]
        for status, message, expected in cases:
            with self.subTest(status=status, expected=expected), self.provider(lambda request: httpx.Response(status, json={'error': {'message': message}})):
                with self.assertRaises(teacher.ProviderError) as caught:
                    await self.collect()
            self.assertIn(expected, str(caught.exception))
            self.assertNotIn(API_KEY, str(caught.exception))

    async def test_network_errors_are_sanitized(self):
        for error, expected in ((httpx.ReadTimeout(API_KEY), 'too long'), (httpx.ConnectError(API_KEY), 'interrupted')):
            def fail(request):
                raise error
            with self.subTest(error=type(error).__name__), self.provider(fail):
                with self.assertRaises(teacher.ProviderError) as caught:
                    await self.collect()
            self.assertIn(expected, str(caught.exception))
            self.assertNotIn(API_KEY, str(caught.exception))

    async def test_structured_lesson_uses_gemini_schema_and_validates_answer(self):
        answer = {'explanation': 'Overfitting memorizes training details.', 'example': 'model.fit(X_train, y_train)', 'practice': 'Compare train and validation scores.', 'follow_up': 'Why keep validation data separate?'}
        requests = []

        def respond(request):
            requests.append(request)
            return httpx.Response(200, json={'candidates': [{'content': {'parts': [{'thought': True, 'text': 'PRIVATE_THOUGHT'}, {'text': json.dumps(answer)}]}, 'finishReason': 'STOP'}]})

        with self.provider(respond):
            result = await main.hosted_reply(LESSONS[0], main.ChatSubmission(message='Explain overfitting', mode='teach'), [], [], self.connection)
        self.assertEqual(result.model_dump(), answer)
        self.assertEqual(len(requests), 1)
        request = requests[0]
        self.assertEqual(str(request.url), gemini.BASE_URL + '/gemini-2.5-flash:generateContent')
        self.assertEqual(request.headers['x-goog-api-key'], API_KEY)
        config = json.loads(request.content)['generationConfig']
        self.assertEqual(config['responseMimeType'], 'application/json')
        self.assertEqual(set(config['responseJsonSchema']['required']), set(answer))
        self.assertNotIn(API_KEY, request.content.decode())

    async def test_structured_lesson_rejects_incomplete_answers(self):
        for candidate in ({'content': {'parts': [{'text': '{}'}]}, 'finishReason': 'MAX_TOKENS'}, {'content': {'parts': []}, 'finishReason': 'STOP'}):
            with self.subTest(candidate=candidate), self.provider(lambda request: httpx.Response(200, json={'candidates': [candidate]})):
                with self.assertRaisesRegex(teacher.ProviderError, 'incomplete lesson'):
                    await gemini.structured_content(self.connection, 'Teach.', [{'role': 'user', 'content': 'Explain'}], {'type': 'object'})


class GeminiConfigurationTests(unittest.TestCase):
    counter = 0

    def setUp(self):
        GeminiConfigurationTests.counter += 1
        main.limits.clear()
        teacher.connections.clear()
        teacher.active_turns.clear()
        self.environment = patch.dict(os.environ, {'OPENAI_API_KEY': '', 'OPENAI_MODEL': '', 'GEMINI_API_KEY': '', 'GEMINI_MODEL': '', 'AI_PROVIDER': '', 'MENTOR_DISABLE_LOCAL_CONFIG': '0'})
        self.environment.start()
        self.addCleanup(self.environment.stop)
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.config = Path(self.temp.name) / 'dummy-provider.json'
        local_config = patch.object(teacher, 'LOCAL_CONFIG', self.config)
        local_config.start()
        self.addCleanup(local_config.stop)
        self.client = TestClient(main.app)
        self.addCleanup(self.client.close)
        self.credentials = {'username': f'gemini{self.counter}', 'password': 'gemini-test-password', 'name': 'Learner'}
        self.assertEqual(self.client.post('/api/auth/register', json=self.credentials).status_code, 201)

    def write_config(self, **overrides):
        self.config.write_text(json.dumps({'provider': 'gemini', 'model': 'gemini-2.5-flash', 'api_key': API_KEY, **overrides}), encoding='utf-8')

    def test_project_connection_survives_sessions_without_exposing_key(self):
        self.write_config()
        settings = self.client.get('/api/teacher/settings')
        self.assertTrue(settings.json()['configured'])
        self.assertEqual(settings.json()['provider'], 'gemini')
        self.assertEqual(settings.json()['connection_source'], 'project')
        self.assertEqual(settings.json()['model'], 'gemini-2.5-flash')
        self.assertNotIn('api_key', settings.json())
        self.assertNotIn(API_KEY, settings.text + self.client.get('/api/dashboard').text + self.client.get('/api/health').text)
        with main.database() as db:
            self.assertNotIn(API_KEY, '\n'.join(db.iterdump()))
        self.assertEqual(self.client.post('/api/auth/logout', json={}).status_code, 200)
        self.assertEqual(self.client.post('/api/auth/login', json=self.credentials).status_code, 200)
        self.assertEqual(self.client.get('/api/teacher/settings').json()['connection_source'], 'project')

    def test_environment_overrides_project_configuration(self):
        self.write_config()
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'dummy-openai-environment-key', 'OPENAI_MODEL': 'custom-openai-model', 'AI_PROVIDER': 'openai'}):
            settings = self.client.get('/api/teacher/settings').json()
            self.assertEqual((settings['provider'], settings['model'], settings['connection_source']), ('openai', 'custom-openai-model', 'environment'))
        self.assertEqual(self.client.get('/api/teacher/settings').json()['provider'], 'gemini')
        with patch.dict(os.environ, {'GEMINI_API_KEY': 'dummy-gemini-environment-key', 'GEMINI_MODEL': 'gemini-custom'}):
            connection = teacher.server_connection()
            self.assertEqual((connection.provider, connection.model, connection.api_key, connection.source), ('gemini', 'gemini-custom', 'dummy-gemini-environment-key', 'environment'))

    def test_provider_switch_requires_new_key_and_keeps_existing_connection(self):
        self.write_config()
        with patch.object(teacher, 'validate_connection', new=AsyncMock()) as validate:
            response = self.client.post('/api/teacher/connect', json={'provider': 'openai', 'api_key': '', 'model': 'gpt-5.4-mini'})
            self.assertEqual(response.status_code, 422)
            validate.assert_not_awaited()
            self.assertEqual(self.client.get('/api/teacher/settings').json()['provider'], 'gemini')
            response = self.client.post('/api/teacher/connect', json={'provider': 'gemini', 'api_key': '', 'model': 'gemini-custom'})
            self.assertEqual(response.status_code, 200)
            validate.assert_awaited_once()
            connection = validate.await_args.args[0]
            self.assertEqual((connection.api_key, connection.provider), (API_KEY, 'gemini'))
        self.assertNotIn(API_KEY, response.text)
        self.assertEqual(response.json()['connection_source'], 'session')
        self.assertEqual(response.json()['model'], 'gemini-custom')

    def test_disconnect_suppresses_project_key_only_for_current_session(self):
        self.write_config()
        response = self.client.request('DELETE', '/api/teacher/connection', json={})
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()['configured'])
        self.assertTrue(self.config.exists())
        with TestClient(main.app) as other:
            self.assertEqual(other.post('/api/auth/login', json=self.credentials).status_code, 200)
            self.assertEqual(other.get('/api/teacher/settings').json()['connection_source'], 'project')

    def test_missing_malformed_and_disabled_local_config_are_safe(self):
        self.assertIsNone(teacher.server_connection())
        for text in ('invalid JSON', '[]', '{"provider": "unknown"}', json.dumps({'provider': 'gemini', 'api_key': API_KEY, 'model': '../wrong'})):
            with self.subTest(config=text):
                self.config.write_text(text, encoding='utf-8')
                self.assertIsNone(teacher.server_connection())
        self.write_config()
        with patch.dict(os.environ, {'MENTOR_DISABLE_LOCAL_CONFIG': '1'}):
            self.assertIsNone(teacher.server_connection())


if __name__ == '__main__':
    unittest.main()
