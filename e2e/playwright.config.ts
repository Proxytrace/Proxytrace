import { defineConfig, devices } from '@playwright/test';

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
      name: 'llm',
      testMatch: /ingestion\.spec\.ts|test-run\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/storageState.json',
      },
      dependencies: ['setup'],
    },
  ],
});
