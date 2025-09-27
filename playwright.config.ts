import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  use: {
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'pnpm exec next dev -p 3000',
      port: 3000,
      env: { NEXT_PUBLIC_UI_V2: 'true' },
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'pnpm exec next dev -p 3001',
      port: 3001,
      env: { NEXT_PUBLIC_UI_V2: 'false' },
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
  projects: [
    {
      name: 'ui-v2',
      use: { baseURL: 'http://127.0.0.1:3000' },
    },
    {
      name: 'legacy',
      use: { baseURL: 'http://127.0.0.1:3001' },
    },
  ],
});
