---
name: create-e2e-test
description: >-
  Write or extend Playwright end-to-end (e2e) browser tests for Proxytrace,
  living in the repo-root `e2e/` suite. Use this whenever the user wants to add,
  write, or fix an e2e test, a Playwright spec, a browser/system test, a
  full-stack or UI integration test, or test a complete user flow/journey that
  crosses a process boundary (browser → API → DB, or proxy → Redis → API → UI):
  CRUD flows, new routes, the OpenAI ingestion proxy, test runs, etc. Trigger it
  even when the user doesn't say "Playwright" or "e2e" by name — e.g. "test that
  a user can create an agent end to end", "add a browser test for the providers
  page", "verify the trace shows up after a proxy call", "make a system test for
  the run flow". Also use it when adding `data-testid` hooks for e2e selection or
  a new method to the e2e `ProxytraceApiClient`. This is for the real-stack
  Playwright suite under `e2e/` — NOT for Vitest component/unit tests under
  `frontend/src/` (those test UI logic in isolation; a different tool).
---

# Creating Proxytrace E2E Tests

Proxytrace has a real, working Playwright e2e suite that boots the **full
production Docker Compose stack** (Postgres + Redis + API + proxy + nginx
frontend) against a throwaway database and drives a real browser. Your job is to
add or fix tests **the way this suite already does it** — a spec that ignores the
shared `ProxytraceApiClient`, the auth/storageState model, or the selector
conventions is debt, not progress.

The authoritative reference is **`e2e/GUIDE.md`** — read it before writing
anything, plus the existing spec closest to what you're testing. This skill is
the fast path; the GUIDE is the source of truth, and copying a real neighbor spec
is the surest way to stay consistent.

## First: is an e2e test even the right tool?

E2e tests cost minutes per run and need the live stack. Reserve them for flows
that **cross a process boundary**. Anything that's pure UI logic, a formatter, or
"does this component render" belongs in a **Vitest unit test** under
`frontend/src/` instead — don't reach for e2e there.

| Scenario | Where |
|----------|-------|
| New CRUD flow (create/read/update/delete an entity through the app) | `core-crud.spec.ts` or a new `tests/<feature>.spec.ts` |
| New top-level route should load clean | add it to `ROUTES` in `smoke.spec.ts` |
| Flow crossing proxy → Redis → API → UI, or needing a real LLM call | a `@llm`-tagged spec |
| Pure UI logic, a formatter, single-component render | **Vitest unit test** in `frontend/src/` — not e2e |

## Layout

The suite is at the **repo root in `e2e/`** (NOT inside `frontend/`):

```
e2e/
├── playwright.config.ts   # projects: setup, core, smoke, llm-ingestion, llm-test-run
│                          #   baseURL http://localhost:5101 (nginx); proxy is :5102
├── run.sh                 # down -v → up --build --wait → playwright test → down -v
├── helpers/
│   └── api-client.ts      # ProxytraceApiClient — typed wrappers for every API call
├── tests/
│   ├── auth.setup.spec.ts # `setup` project: first-admin + setup, saves storageState
│   ├── smoke.spec.ts      # every main route loads with no console errors
│   ├── core-crud.spec.ts  # CRUD verified via API + UI
│   ├── ingestion.spec.ts  # @llm: real proxy call → trace in Traces UI
│   └── test-run.spec.ts   # @llm: suite + case + evaluator + run → Runs UI
└── .auth/storageState.json # written by setup; gitignored; loaded by other projects
```

Supporting pieces at the root: `docker-compose.e2e.yml` (the e2e overlay) and
`.github/workflows/e2e.yml` (CI, runs core+smoke always, `@llm` only when
`OPENAI_API_KEY` is set). Operator notes: `manual/admin/e2e-tests.md`.

## The shape of a spec

Import `test`/`expect` from **`@playwright/test`** directly (this suite does NOT
use a custom fixtures wrapper). Use `ProxytraceApiClient` from
`../helpers/api-client` to set up prerequisite data over the API rather than
clicking through the UI — that keeps tests fast and independent of other flows.
Group with `test.describe`.

```ts
import { test, expect } from '@playwright/test';
import { ProxytraceApiClient } from '../helpers/api-client';

test.describe('My Feature', () => {
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    const api = new ProxytraceApiClient(request);
    const { token } = await api.login('admin@e2e.test', 'E2ePassword1!');
    authToken = token;
    api.setToken(token);
    // create prerequisite data via api.* here
  });

  test('entity appears in the UI', async ({ page }) => {
    await page.goto('/my-route', { waitUntil: 'load' });
    await expect(page.getByTestId('my-feature-list')).toBeVisible();
  });
});
```

`page.goto` takes a **path** (`/agents`) — `baseURL` is configured. Tests that
only hit the API can take `{ request }` and skip `page`.

## Auth — you start already logged in

The `setup` project (`auth.setup.spec.ts`) runs first, creates the first admin
on the fresh DB, completes initial setup, and saves the browser session to
`.auth/storageState.json`. The `core`, `smoke`, and `llm-*` projects declare
`dependencies: ['setup']` and load that storageState, so **the `page` fixture is
already authenticated** — never navigate to `/login` or re-auth in a UI spec.

The catch: storageState only authenticates the **browser**, not the `request`
fixture. For API calls inside a test, get a token via
`api.login('admin@e2e.test', 'E2ePassword1!')` in `beforeAll` and `setToken` it
(the client attaches the Bearer header). Those credentials are the fixed e2e
admin created by setup.

## Selectors — `data-testid` first

The GUIDE's selector priority (this is the suite's convention; follow it):

1. **`data-testid`** for anything you assert on or interact with — survives text
   changes, refactors, i18n. `page.getByTestId('provider-create-btn')`.
2. **ARIA role + accessible name** for interactive elements without a test id:
   `page.getByRole('button', { name: 'Delete provider' })`.
3. **`getByText`** only to assert non-interactive content is *present*
   (`expect(page.getByText('E2E Test Provider')).toBeVisible()`) — never to click
   (text is fragile).
4. **`getByRole('navigation' | 'list' | …)`** for structural smoke checks.

### `data-testid` naming convention

`<entity>-<element-type>[-<qualifier>]`, dynamic id in the qualifier. The id is a
**contract** between component and test — keep it stable across refactors.

| Pattern | Example |
|---------|---------|
| `<entity>-list` | `provider-list` |
| `<entity>-row-<id>` | `` `provider-row-${id}` `` |
| `<entity>-create-btn` | `provider-create-btn` |
| `<entity>-edit-btn-<id>` / `<entity>-delete-btn-<id>` | `provider-delete-btn-{id}` |
| `<feature>-empty-state` / `<feature>-loading` | `provider-empty-state` |

When a role/label/text locator genuinely can't isolate an element, add the
`data-testid` in the React component. That's a real frontend change — follow
`frontend/BEST_PRACTICES.md` and `frontend/DESIGN.md`. Don't reach for a test id
first; it's the fallback, not the default.

## Data setup — via ProxytraceApiClient

Create prerequisites through `ProxytraceApiClient` (it mirrors the real public
API contract). If the endpoint your test needs has **no method yet, add one to
`e2e/helpers/api-client.ts`** rather than POSTing inline — keep it typed and
throw on `!res.ok()`, matching the existing methods:

```ts
async createFoo(name: string): Promise<{ id: string }> {
  const res = await this.request.post('/api/foos', {
    headers: this.headers(),
    data: { name },
  });
  if (!res.ok()) throw new Error(`create foo failed: ${res.status()} ${await res.text()}`);
  return res.json();
}
```

Confirm the path and request body against the real contract — the frontend
service in `frontend/src/api/*.ts` or the controller in `Proxytrace.Api` — so the
call isn't guesswork.

## Async, waiting, and SSE — the gotchas that cause flakes

- **`waitUntil: 'load'`, never `'networkidle'`.** Proxytrace opens long-lived SSE
  connections after load (live traces, test results), so `networkidle` never
  resolves and the test hangs. To wait for data, assert on a specific element
  instead: `await expect(page.getByTestId('trace-list')).toBeVisible()`.
- **`expect.poll` for eventually-consistent side effects** (trace ingestion, run
  completion) — never `page.waitForTimeout(...)`. A fixed sleep is slow and
  flaky; poll the real condition:
  ```ts
  await expect.poll(
    async () => (await api.getTestRunGroup(groupId)).status,
    { timeout: 60_000, intervals: [3_000], message: 'run did not complete' },
  ).toMatch(/Completed|Failed/);
  ```
- Bump `test.setTimeout(...)` on specs that make real LLM round-trips so the test
  timeout comfortably exceeds the poll window (see the `@llm` specs).

Assert what a **user observes** with web-first (auto-retrying) assertions —
`toBeVisible`, `toHaveText`, `toHaveCount`. Don't assert on DOM structure,
request counts, or internal state.

## LLM-gated specs

Any test that hits a real upstream LLM must be gated so CI (and key-less local
runs) skip it cleanly. Tag the describe `@llm` and make `test.skip` the **first
statement** inside it:

```ts
test.describe('@llm my feature', () => {
  test.skip(!process.env.OPENAI_API_KEY, 'requires OPENAI_API_KEY env var');
  // ...
});
```

Never put LLM-dependent assertions in `core` or `smoke` specs. Proxy ingestion
goes through `http://localhost:5102/openai/v1/...` with a Proxytrace-issued key
(see `ingestion.spec.ts`); note a **system message is required** or the parser
drops the captured call, and use `max_completion_tokens` (not `max_tokens`).

## Wiring a new spec file into a project

Playwright only runs files matched by a project's `testMatch` in
`playwright.config.ts`. Adding `tests/foo.spec.ts` to `tests/` is **not enough**.

- New non-LLM spec → widen the `core` (or `smoke`) project's `testMatch` regex to
  include it, e.g. `/core-crud\.spec\.ts|foo\.spec\.ts/`.
- New `@llm` spec → add it to an `llm-*` project's `testMatch`. If it depends on
  data another spec creates (e.g. an agent only exists after ingestion), set
  `dependencies` accordingly (see how `llm-test-run` depends on `llm-ingestion`).
- New route smoke → usually just one entry in `ROUTES` in `smoke.spec.ts`; no
  config change.

## Running and verifying

The suite needs the full Docker stack. From the repo root:

```bash
bash e2e/run.sh                          # down -v → up --build --wait → all specs → down -v
OPENAI_API_KEY=sk-... bash e2e/run.sh    # also runs @llm specs
```

With the stack already up, iterate faster from `e2e/`:

```bash
cd e2e
npx playwright test --project=core
npx playwright test tests/core-crud.spec.ts
npx playwright test --headed --project=core      # watch it
PWDEBUG=1 npx playwright test tests/core-crud.spec.ts  # step through
npm run report                                    # open last HTML report
```

Always `down -v` between full runs — `auth.setup.spec.ts` asserts
`setupRequired: true`, which only holds on an empty DB. `run.sh` does this for
you.

**Run the spec you wrote (at least its file) before claiming it passes** — an
unexecuted spec is unverified. If Docker isn't available in your environment, say
so plainly and at minimum typecheck the spec (`cd e2e && npx tsc --noEmit`);
don't assert it passes.

Keep docs honest: `e2e/GUIDE.md` and `manual/admin/e2e-tests.md` describe the
suite as a whole, so a routine new spec needs no doc change — update them only
when you add a new convention, command, fixture, or `ProxytraceApiClient`
surface worth documenting (per CLAUDE.md, the manual tracks the product).

## Before you call it done

- Imports `test`/`expect` from `@playwright/test`; setup uses `ProxytraceApiClient`.
- No `/login` navigation in UI specs (storageState handles auth); API calls get a
  token via `api.login(...)` + `setToken`.
- Selectors are `data-testid`-first; any new id is stable and follows the naming
  convention.
- Prerequisite data created via `ProxytraceApiClient` (new method added to
  `api-client.ts` if one was missing), matching the real API contract.
- `waitUntil: 'load'` everywhere; `expect.poll` for async; **no** `waitForTimeout`.
- Real-LLM work is `@llm`-tagged and `test.skip`-gated; not in core/smoke.
- New spec file is wired into a project's `testMatch` (and `dependencies` if it
  relies on another spec's data).
- You actually ran it (or clearly flagged you couldn't, and typechecked instead).
