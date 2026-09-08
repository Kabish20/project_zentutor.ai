import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

test('stopping a partial streamed answer preserves it and the next draft', async ({ page }) => {
  await register(page, 'stop');
  const date = new Date().toISOString();
  const conversation = { id: 88, title: 'Explain model training', created: date, updated: date };
  const saved = [
    { id: 1, role: 'user', content: 'Explain model training', status: 'complete', created: date },
    {
      id: 2,
      role: 'assistant',
      content: 'Training adjusts model parameters.',
      status: 'interrupted',
      created: date,
    },
  ];
  await page.route('**/api/teacher/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/teacher/settings')
      return route.fulfill({
        json: {
          configured: true,
          connection_source: 'session',
          model: 'gpt-5.4-mini',
          default_model: 'gpt-5.4-mini',
          preferences: { level: 'beginner', style: 'balanced', language: 'English' },
        },
      });
    if (path === '/api/teacher/conversations')
      return route.fulfill({ json: route.request().method() === 'POST' ? conversation : [] });
    if (path === '/api/teacher/conversations/88')
      return route.fulfill({ json: { conversation, messages: saved } });
    return route.fallback();
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'OpenAI connected', exact: true })).toBeVisible();
  await page.evaluate(() => {
    const originalFetch = window.fetch;
    window.fetch = (input, options) => {
      if (String(input).endsWith('/api/teacher/conversations/88/messages')) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  type: 'start',
                  user_message: {
                    id: 1,
                    role: 'user',
                    content: 'Explain model training',
                    status: 'complete',
                  },
                  assistant_message_id: 2,
                }) + '\n',
              ),
            );
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ type: 'delta', text: 'Training adjusts model parameters.' }) +
                  '\n',
              ),
            );
            options.signal.addEventListener('abort', () => {
              window.teacherAbortObserved = true;
              controller.error(new DOMException('Request aborted', 'AbortError'));
            });
          },
        });
        return Promise.resolve(
          new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson' } }),
        );
      }
      return originalFetch(input, options);
    };
  });
  const composer = page.getByLabel('Ask your AI and ML teacher');
  await composer.fill('Explain model training');
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.getByText('Training adjusts model parameters.', { exact: true })).toBeVisible();
  await composer.fill('What is an epoch?');
  await page.getByRole('button', { name: 'Stop generating' }).click();
  await expect(page.getByRole('button', { name: 'Send question' })).toBeEnabled();
  await expect(page.getByText('Response stopped', { exact: true })).toBeVisible();
  await expect(composer).toHaveValue('What is an epoch?');
  expect(await page.evaluate(() => window.teacherAbortObserved)).toBe(true);
});

async function register(page, suffix) {
  const response = await page.request.post('/api/auth/register', {
    data: {
      username: `ai_${suffix}_${Date.now()}`,
      password: 'teacher-browser-password',
      name: 'Kabish',
    },
  });
  expect(response.ok()).toBeTruthy();
}

test('Gemini project connection keeps credentials private and supports provider selection', async ({
  page,
}) => {
  await register(page, 'gemini');
  const requests = [];
  let settings = {
    configured: true,
    provider: 'gemini',
    connection_source: 'project',
    model: 'gemini-2.5-flash',
    default_model: 'gemini-2.5-flash',
    default_models: { openai: 'gpt-5.4-mini', gemini: 'gemini-2.5-flash' },
    preferences: { level: 'beginner', style: 'balanced', language: 'English' },
  };
  await page.route('**/api/teacher/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/teacher/settings') return route.fulfill({ json: settings });
    if (path === '/api/teacher/conversations') return route.fulfill({ json: [] });
    if (path === '/api/teacher/connect') {
      const body = route.request().postDataJSON();
      requests.push(body);
      settings = {
        ...settings,
        provider: body.provider,
        model: body.model,
        connection_source: 'session',
      };
      return route.fulfill({ json: settings });
    }
    return route.fallback();
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Gemini connected', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Your teaching studio' });
  await expect(dialog.getByText('Connected to Gemini', { exact: true })).toBeVisible();
  await expect(
    dialog.getByText('gemini-2.5-flash · Project connection', { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByLabel('Gemini API key', { exact: true })).toHaveValue('');
  await expect(dialog.getByLabel('Gemini API key', { exact: true })).toHaveAttribute(
    'type',
    'password',
  );
  await dialog.getByRole('button', { name: 'Update connection', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('Gemini key and model access verified');
  expect(requests[0]).toEqual({ provider: 'gemini', api_key: null, model: 'gemini-2.5-flash' });

  await dialog.getByLabel('AI provider', { exact: true }).selectOption('openai');
  await expect(dialog.getByLabel('Model', { exact: true })).toHaveValue('gpt-5.4-mini');
  await expect(dialog.getByRole('button', { name: 'Connect OpenAI', exact: true })).toBeDisabled();
  await expect(dialog.getByLabel('OpenAI API key', { exact: true })).toHaveJSProperty(
    'required',
    true,
  );
  await dialog.getByLabel('AI provider', { exact: true }).selectOption('gemini');
  await expect(dialog.getByLabel('Model', { exact: true })).toHaveValue('gemini-2.5-flash');
  await expect(dialog.getByRole('link', { name: 'Get an API key' })).toHaveAttribute(
    'href',
    'https://aistudio.google.com/apikey',
  );
  await dialog.getByLabel('Gemini API key', { exact: true }).fill('AIza-test-only-not-a-real-key');
  await dialog.getByRole('button', { name: 'Update connection', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('Gemini key and model access verified');
  expect(requests[1]).toEqual({
    provider: 'gemini',
    api_key: 'AIza-test-only-not-a-real-key',
    model: 'gemini-2.5-flash',
  });
  await expect(dialog.getByLabel('Gemini API key', { exact: true })).toHaveValue('');
});

for (const [device, width, height] of [
  ['desktop', 1440, 1000],
  ['mobile', 390, 844],
]) {
  test(`${device}: AI teacher setup, preferences, and honest disconnected state`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await register(page, device);
    await page.goto('/');
    await expect(page.getByRole('region', { name: 'AI and ML teacher' })).toBeVisible();
    await expect(
      page.getByText('Connect OpenAI to start a conversation with your teacher.'),
    ).toBeVisible();
    await page.screenshot({
      path: fileURLToPath(new URL(`../../tmp/${device}-ai-teacher.png`, import.meta.url)),
      fullPage: true,
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    const composer = page.getByLabel('Ask your AI and ML teacher');
    await composer.fill('Explain neural networks with a Python example.');
    await page.getByRole('button', { name: 'Connect OpenAI to send', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Your teaching studio' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('OpenAI API key', { exact: true })).toHaveAttribute(
      'type',
      'password',
    );
    await expect(dialog.getByLabel('Model', { exact: true })).toHaveValue('gpt-5.4-mini');
    await dialog.getByRole('tab', { name: 'Teaching preferences' }).click();
    await dialog.getByLabel('Your experience').selectOption('intermediate');
    await dialog.getByLabel('Explanation style').selectOption('step_by_step');
    await dialog.getByLabel('Teaching language').selectOption('Tamil + English');
    await dialog.getByRole('button', { name: 'Save preferences' }).click();
    await expect(dialog.getByText('Your teaching preferences are saved.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Close settings' }).click();
    await expect(composer).toHaveValue('Explain neural networks with a Python example.');
    const preferences = await page.request.get('/api/teacher/settings');
    expect((await preferences.json()).preferences).toEqual({
      level: 'intermediate',
      style: 'step_by_step',
      language: 'Tamil + English',
    });
    await page.reload();
    await expect(page.getByText('Intermediate · Tamil + English', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('AI teacher renders streamed Markdown, preserves follow-up drafts, and resumes saved chat', async ({
  page,
}) => {
  await register(page, 'stream');
  const errors = [];
  const requests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const settings = {
    configured: true,
    connection_source: 'session',
    model: 'gpt-5.4-mini',
    default_model: 'gpt-5.4-mini',
    preferences: { level: 'beginner', style: 'balanced', language: 'English' },
  };
  const conversation = {
    id: 99,
    title: 'Explain gradient descent',
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
  };
  let messages = [];
  let created = false;
  let release;
  await page.route('**/api/teacher/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/teacher/settings') return route.fulfill({ json: settings });
    if (path === '/api/teacher/conversations') {
      if (route.request().method() === 'POST') {
        created = true;
        return route.fulfill({ status: 201, json: conversation });
      }
      return route.fulfill({ json: created ? [conversation] : [] });
    }
    if (path === '/api/teacher/conversations/99')
      return route.fulfill({ json: { conversation, messages } });
    if (path === '/api/teacher/conversations/99/messages') {
      const body = route.request().postDataJSON();
      requests.push(body);
      const start = messages.length + 1;
      const user = {
        id: start,
        role: 'user',
        content: body.message,
        status: 'complete',
        created: conversation.created,
      };
      const text =
        '## Gradient descent\n\nMove **opposite the gradient** to reduce a loss.\n\n```python\nw = w - learning_rate * gradient\n```\n\n| Step | Purpose |\n| --- | --- |\n| Update | Reduce loss |\n\n<script>window.untrustedTeacherExecuted = true</script>\n\n![blocked](https://invalid.example/tracker.png)';
      const assistant = {
        id: start + 1,
        role: 'assistant',
        content: text,
        status: 'complete',
        created: conversation.created,
      };
      if (requests.length === 1)
        await new Promise((resolve) => {
          release = resolve;
        });
      messages = [...messages, user, assistant];
      const events = [
        { type: 'start', user_message: user, assistant_message_id: assistant.id },
        { type: 'delta', text: text.slice(0, 36) },
        { type: 'delta', text: text.slice(36) },
        { type: 'done', message: assistant, conversation },
      ];
      return route.fulfill({
        contentType: 'application/x-ndjson',
        body: events.map((event) => JSON.stringify(event)).join('\n') + '\n',
      });
    }
    return route.fallback();
  });
  await page.goto('/');
  const composer = page.getByLabel('Ask your AI and ML teacher');
  await composer.fill('Explain gradient descent');
  await page.getByRole('button', { name: 'Send question', exact: true }).click();
  await expect.poll(() => Boolean(release)).toBe(true);
  await expect(page.getByRole('button', { name: 'Stop generating' })).toBeVisible();
  await composer.fill('Why does the learning rate matter?');
  release();
  await expect(page.getByRole('heading', { name: 'Gradient descent', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy code', exact: true })).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(composer).toHaveValue('Why does the learning rate matter?');
  expect(await page.evaluate(() => window.untrustedTeacherExecuted)).toBeUndefined();
  await expect(page.locator('.teacher-markdown img')).toHaveCount(0);
  await page.screenshot({
    path: fileURLToPath(new URL('../../tmp/desktop-ai-answer-test.png', import.meta.url)),
    fullPage: true,
  });
  await composer.press('Enter');
  await expect(page.getByRole('heading', { name: 'Gradient descent', exact: true })).toHaveCount(2);
  expect(requests[1].message).toBe('Why does the learning rate matter?');
  await page.reload();
  await page.getByRole('button', { name: 'Explain gradient descent', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Gradient descent', exact: true })).toHaveCount(2);
  expect(errors).toEqual([]);
});
