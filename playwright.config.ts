import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  testMatch: /.*\.spec\.ts/,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://127.0.0.1:8080', channel: process.env.PW_CHANNEL || undefined },
  webServer: { command: (process.env.PW_PY || 'python3') + ' -m http.server 8080 --bind 127.0.0.1', url: 'http://127.0.0.1:8080/index.html', reuseExistingServer: !process.env.CI },
});
