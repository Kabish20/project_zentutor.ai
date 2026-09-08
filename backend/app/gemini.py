"""Gemini REST adapters. Credentials stay in headers; provider errors stay private."""
import json

import httpx

from .teacher import ProviderError

BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'


def error_message(status, payload=None):
    error = payload.get('error', {}) if isinstance(payload, dict) else {}
    # Inspect only to classify; never forward the raw provider response.
    message = str(error.get('message', '')).lower() if isinstance(error, dict) else ''
    if 'leaked' in message:
        return 'Google has disabled this API key because it was reported as leaked. Create a replacement in Google AI Studio and update the connection.'
    if status == 401 or (status == 400 and ('api key' in message or 'api_key' in message)):
        return 'Gemini did not accept this API key. Reconnect with a valid Google AI Studio key.'
    if status == 403:
        return 'This Gemini key does not have permission. Check its API restrictions and project access in Google AI Studio.'
    if status == 404:
        return 'This Gemini model is unavailable. Choose a model available to your Google AI project.'
    if status == 429:
        return 'Gemini quota is unavailable or its request limit was reached. Check your Google AI Studio quota and billing, then retry.'
    if status == 400:
        return 'Gemini could not use this model or request. Check the model name and regional availability.'
    return 'Gemini is temporarily unavailable. Your conversation is saved; please retry.'


async def check_response(response):
    if response.status_code == 200:
        return
    try:
        payload = json.loads(await response.aread())
    except (ValueError, TypeError):
        payload = None
    raise ProviderError(error_message(response.status_code, payload))


async def validate_model(connection):
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(f'{BASE_URL}/{connection.model}',
                                        headers={'x-goog-api-key': connection.api_key})
            await check_response(response)
            model = response.json()
        if (model.get('name') != f'models/{connection.model}'
                or 'generateContent' not in model.get('supportedGenerationMethods', [])):
            raise ProviderError('Choose a Gemini model that supports text generation.')
    except (httpx.HTTPError, ValueError, AttributeError, TypeError):
        raise ProviderError('Could not reach Gemini to check this model. Check the connection and retry.') from None


def request_payload(connection, instructions, inputs, schema=None):
    contents = []
    for item in inputs:
        role = 'model' if item['role'] == 'assistant' else 'user'
        # Gemini expects alternating turns; interrupted replies may leave adjacent user turns.
        if contents and contents[-1]['role'] == role:
            contents[-1]['parts'].append({'text': item['content']})
        else:
            contents.append({'role': role, 'parts': [{'text': item['content']}]})
    config = {'maxOutputTokens': 6000}
    if connection.model in ('gemini-2.5-flash', 'gemini-2.5-flash-lite'):
        config['thinkingConfig'] = {'thinkingBudget': 0}
    if schema:
        config.update(responseMimeType='application/json', responseJsonSchema=schema)
    return {'systemInstruction': {'parts': [{'text': instructions}]},
            'contents': contents, 'generationConfig': config}


def response_text(event):
    if event.get('error'):
        raise ProviderError('Gemini could not finish this answer. Please retry.')
    if event.get('promptFeedback', {}).get('blockReason'):
        raise ProviderError('Gemini could not answer this request. Try rephrasing your teaching question.')
    candidates = event.get('candidates', [])
    if not candidates:
        return '', None
    candidate = candidates[0]
    reason = candidate.get('finishReason')
    if reason and reason not in ('STOP', 'MAX_TOKENS'):
        raise ProviderError('Gemini could not complete this answer. Try rephrasing your question.')
    text = ''.join(part['text'] for part in candidate.get('content', {}).get('parts', [])
                   if isinstance(part.get('text'), str) and not part.get('thought'))
    return text, reason


async def stream_content(connection, instructions, inputs):
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(90, connect=15)) as client:
            async with client.stream('POST', f'{BASE_URL}/{connection.model}:streamGenerateContent',
                                     params={'alt': 'sse'}, headers={'x-goog-api-key': connection.api_key},
                                     json=request_payload(connection, instructions, inputs)) as response:
                await check_response(response)
                data_lines = []

                async def events():
                    async for line in response.aiter_lines():
                        if line.startswith('data:'):
                            data_lines.append(line[5:].lstrip())
                        elif not line and data_lines:
                            yield json.loads('\n'.join(data_lines))
                            data_lines.clear()
                    if data_lines:
                        yield json.loads('\n'.join(data_lines))

                completed = False
                async for event in events():
                    text, reason = response_text(event)
                    if text:
                        yield text
                    if reason == 'MAX_TOKENS':
                        raise ProviderError('The answer reached its response limit. Ask to continue or narrow the question.')
                    if reason == 'STOP':
                        completed = True
                        break
                if not completed:
                    raise ProviderError('The connection ended before the answer finished. Please retry or ask to continue.')
    except httpx.TimeoutException:
        raise ProviderError('Gemini took too long to respond. Please retry with a shorter question.') from None
    except (httpx.HTTPError, ValueError, AttributeError, TypeError, KeyError):
        raise ProviderError('The Gemini connection was interrupted. Please retry; your conversation is saved.') from None


async def structured_content(connection, instructions, inputs, schema):
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(f'{BASE_URL}/{connection.model}:generateContent',
                                         headers={'x-goog-api-key': connection.api_key},
                                         json=request_payload(connection, instructions, inputs, schema))
            await check_response(response)
        text, reason = response_text(response.json())
        if reason != 'STOP' or not text:
            raise ProviderError('Gemini returned an incomplete lesson answer. Please retry.')
        return text
    except (httpx.HTTPError, ValueError, AttributeError, TypeError, KeyError):
        raise ProviderError('Gemini could not return a valid lesson answer. Please retry.') from None
