import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load e2e/.env (if present) before Playwright reads process.env.
// Shell env vars take precedence over .env values.
config({ path: resolve(__dirname, '.env'), override: false });

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['html', { outputFolder: 'playwright-report', open: 'never' }], ['github']]
    : [['html', { outputFolder: 'playwright-report', open: 'on-failure' }]],
  use: {
    baseURL: 'http://localhost:5101',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.spec\.ts/,
    },
    {
      name: 'core',
      testMatch: /core-crud\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/storageState.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'smoke',
      testMatch: /smoke\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/storageState.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'llm-ingestion',
      testMatch: /ingestion\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/storageState.json',
      },
      dependencies: ['setup'],
    },
    {
      // test-run.spec relies on an agent, which only exists once a call has been ingested.
      // Depend on the ingestion project so it always runs first, even with multiple workers.
      name: 'llm-test-run',
      testMatch: /test-run\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/storageState.json',
      },
      dependencies: ['llm-ingestion'],
    },
  ],
});
