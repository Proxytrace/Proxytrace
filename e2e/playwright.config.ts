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
    {
      // proposals.spec seeds a proposal against an agent, which only exists once a call has
      // been ingested. Depend on the ingestion project so an agent is present first.
      name: 'llm-proposals',
      testMatch: /proposals\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/storageState.json',
      },
      dependencies: ['llm-ingestion'],
    },
    {
      // Logs into the Free-tier stack (frontend-free / api-free on :5103) and saves a
      // storageState for that origin. The admin already exists (shared DB, created by `setup`),
      // so this only authenticates the browser against the :5103 origin.
      name: 'licensing-setup',
      testMatch: /licensing\.setup\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5103',
      },
      dependencies: ['setup'],
    },
    {
      // Free-tier feature-gate checks: must hit the unlicensed :5103 stack, not the Enterprise
      // default (:5101). Non-LLM and stateless (feature gates 402 regardless of DB contents),
      // so it needs only `licensing-setup`, not the ingestion projects.
      name: 'licensing',
      testMatch: /licensing\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5103',
        storageState: '.auth/licensing-state.json',
      },
      dependencies: ['licensing-setup'],
    },
  ],
});
