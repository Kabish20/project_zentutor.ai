import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

test('tutor preserves a new draft during a pending reply and suggestion sends', async ({
  page,
}) => {
  await page.request.post('/api/auth/register', {
    data: {
      username: `draft_${Date.now()}`,
      password: 'browser-test-password',
      name: 'Draft Learner',
    },
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.getByRole('button', { name: 'Start learning', exact: true }).click();
  await page.getByRole('tab', { name: 'Ask your tutor' }).click();
  const input = page.getByLabel('Message your tutor');
  await expect(page.getByRole('button', { name: 'Start this lesson' })).toBeVisible();
  let release;
  await page.route('**/api/lessons/python-functions/chat', async (route) => {
    await new Promise((resolve) => {
      release = resolve;
    });
    await route.continue();
  });
  await input.fill('Help me learn functions.');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect.poll(() => Boolean(release)).toBe(true);
  await input.fill('My next question should stay here.');
  release();
  await expect(page.getByRole('button', { name: 'Send message' })).toBeEnabled();
  await expect(input).toHaveValue('My next question should stay here.');
  await page.unroute('**/api/lessons/python-functions/chat');
  await page.getByRole('button', { name: 'Give me a hint', exact: true }).click();
  await expect(page.getByText('Try it yourself', { exact: true })).toBeVisible();
  await expect(input).toHaveValue('My next question should stay here.');
});

for (const [label, width, height] of [
  ['desktop', 1440, 1000],
  ['mobile', 390, 844],
]) {
  test(`${label}: account, lesson, tutor, practice, quiz, evidence, persistence`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const username = `browser_${label}_${Date.now()}`;
    await page.goto('/');
    await page.getByLabel('Your name', { exact: true }).fill('Kabish');
    await page.getByLabel('Username', { exact: true }).fill(username);
    await page.getByLabel('Password', { exact: true }).fill('browser-test-password');
    await page.getByRole('button', { name: 'Create my learning space' }).click();
    await page.getByRole('button', { name: 'Overview', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Keep growing, Kabish.' })).toBeVisible();
    await page.screenshot({
      path: fileURLToPath(new URL(`../../tmp/${label}-overview.png`, import.meta.url)),
      fullPage: true,
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    await page.getByRole('button', { name: 'Prepare the weekly deliverable', exact: true }).click();
    await page
      .getByPlaceholder('File path, results, or a short evidence note')
      .fill('cleaner.py: checked empty and invalid rows');
    await page.getByRole('button', { name: 'Save as done' }).click();
    await expect(
      page.getByText('Self-reported · cleaner.py: checked empty and invalid rows'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Start learning', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Functions & data structures', exact: true }),
    ).toBeVisible();
    await page.getByRole('tab', { name: 'Ask your tutor' }).click();
    await page.getByRole('button', { name: 'Start this lesson' }).click();
    await expect(
      page.getByText(
        'What should a function do when a booking contains a negative number of nights?',
        { exact: true },
      ),
    ).toBeVisible();
    await page.getByLabel('Message your tutor').fill('I would validate it and raise an error.');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByText('Try it yourself', { exact: true })).toBeVisible();
    await page.screenshot({
      path: fileURLToPath(new URL(`../../tmp/${label}-tutor.png`, import.meta.url)),
      fullPage: true,
    });

    await page.getByRole('tab', { name: 'Practice', exact: true }).click();
    await page
      .getByLabel('Your Python code')
      .fill(
        'def clean_tags(values):\n    return list(dict.fromkeys(v.strip().lower() for v in values if v.strip()))',
      );
    await page.getByRole('button', { name: 'Save & check' }).click();
    await expect(
      page.getByText('Python syntax parses successfully. Your code was not executed.'),
    ).toBeVisible();
    await page.getByRole('tab', { name: 'Check understanding' }).click();
    await page.getByRole('radio', { name: 'Set', exact: true }).check();
    await page.getByRole('radio', { name: 'Nothing; add validation when needed' }).check();
    await page.getByRole('radio', { name: 'O(1)', exact: true }).check();
    await page.getByRole('button', { name: 'Check my answers' }).click();
    await expect(page.getByText('100% · Quiz mastered')).toBeVisible();

    await page.getByRole('button', { name: 'Review & progress' }).click();
    const row = page.getByRole('row').filter({ hasText: 'Functions & data structures' });
    await expect(row).toContainText('100%');
    await expect(row).toContainText('Quiz mastered');
    await page.reload();
    await page.getByRole('button', { name: 'Overview', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Keep growing, Kabish.' })).toBeVisible();
    await expect(
      page.getByText('Self-reported · cleaner.py: checked empty and invalid rows'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'My curriculum' }).click();
    await expect(page.getByRole('heading', { name: 'Lay the foundations.' })).toBeVisible();
    await expect(
      page.getByRole('button').filter({ hasText: 'Functions & data structures' }),
    ).toContainText('Quiz mastered');
    await page.getByRole('button', { name: 'Resource shelf' }).click();
    await expect(page.getByRole('link', { name: /Python tutorial/ })).toHaveAttribute(
      'href',
      'https://docs.python.org/3/tutorial/',
    );
    await page.getByRole('button', { name: 'Log out', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Your next chapter starts here.' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Already have an account? Sign in' }).click();
    await page.getByLabel('Username', { exact: true }).fill(username);
    await page.getByLabel('Password', { exact: true }).fill('browser-test-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('button', { name: 'Overview', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Keep growing, Kabish.' })).toBeVisible();
    expect(errors).toEqual([]);
  });
}
