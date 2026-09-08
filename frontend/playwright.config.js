import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const python = existsSync(new URL('../.venv/Scripts/python.exe', import.meta.url))
  ? '"../.venv/Scripts/python.exe"'
  : existsSync(new URL('../.venv/bin/python', import.meta.url))
    ? '"../.venv/bin/python"'
    : 'python';

export default defineConfig({
  testDir: './tests',
  outputDir: '../tmp/browser-results',
  timeout: 45000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:8017', channel: 'msedge', headless: true },
  webServer: {
    command: `${python} -B -m uvicorn app.main:app --app-dir ../backend --host 127.0.0.1 --port 8017`,
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    url: 'http://127.0.0.1:8017/api/health',
    reuseExistingServer: false,
    env: {
      MENTOR_DB: fileURLToPath(new URL('../tmp/browser-tests.db', import.meta.url)),
      OPENAI_API_KEY: '',
      OPENAI_MODEL: '',
      GEMINI_API_KEY: '',
      GEMINI_MODEL: '',
      AI_PROVIDER: '',
      MENTOR_DISABLE_LOCAL_CONFIG: '1',
    },
  },
});
