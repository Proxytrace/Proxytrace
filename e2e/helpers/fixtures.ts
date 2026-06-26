import { test as base, expect, type APIRequestContext } from '@playwright/test';

// Playwright's built-in `request` fixture is test-scoped: the APIRequestContext it hands out is
// disposed after each test, and reusing one obtained in `beforeAll` inside a test body throws
// "Fixture { request } from beforeAll cannot be reused in a test". Many specs legitimately build a
// ProxytraceApiClient once in `beforeAll` (login + resolve setup ids) and reuse it across tests.
//
// To support that, we override `request` with a passthrough to a *worker-scoped* APIRequestContext
// (`_apiContext`). Because the underlying context lives for the whole worker, the same instance is
// returned in `beforeAll` and in every test, so reuse is allowed. The context inherits the running
// project's `baseURL` (e.g. :5101 for the default stack, :5103 for the licensing projects). Our API
// calls authenticate with Bearer tokens from `login()`, so dropping per-test storageState cookies on
// this context is harmless.
// Projects whose specs run authenticated against the default stack and accumulate domain data in
// the shared DB. Before each of their tests we reset the server to the setup baseline (see below)
// so specs that assert exact counts / empty states are not affected by earlier specs' data. The
// `setup` project (creates the baseline), `auth-flows` (drives auth from a clean session) and the
// licensing projects (separate stack) are intentionally excluded.
const RESET_PROJECTS = new Set(['core', 'smoke']);

export const test = base.extend<{ _reset: void }, { _apiContext: APIRequestContext }>({
  _apiContext: [
    async ({ playwright }, use, workerInfo) => {
      const context = await playwright.request.newContext({
        baseURL: workerInfo.project.use.baseURL,
      });
      await use(context);
      await context.dispose();
    },
    { scope: 'worker' },
  ],
  request: async ({ _apiContext }, use) => {
    await use(_apiContext);
  },
  // Auto fixture: reset the DB to the setup baseline before each core/smoke test. Runs as part of
  // fixture setup (before the spec's own `beforeEach` seeding), so specs that seed per test re-seed
  // onto a clean baseline. The truncate keeps users/providers/projects, so the admin token and the
  // resolved endpoint/project ids stay valid; only per-run content (agents, traces, evaluators,
  // suites, runs, proposals, invites) is cleared.
  _reset: [
    async ({ _apiContext }, use, testInfo) => {
      if (RESET_PROJECTS.has(testInfo.project.name)) {
        // The reset endpoint is anonymous (test-only, see TestSupportController) so it does NOT
        // depend on an admin login. That matters: an MFA spec can leave the shared admin behind a
        // second factor, where a password login yields no session token — the old "login then reset
        // with that token" flow then silently skipped the reset (Bearer null → 401), so the very
        // truncate that clears the MFA enrollment never ran. Calling reset directly always restores
        // the clean, MFA-disabled baseline.
        await _apiContext.post('/api/test/reset');
      }
      await use();
    },
    { auto: true },
  ],
});

export { expect };
