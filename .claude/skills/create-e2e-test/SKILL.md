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
│   ├── api-client.ts      # ProxytraceApiClient — typed wrappers for every API call
│   └── fixtures.ts        # extended test: worker-scoped `request` + per-test DB reset
│                          #   (import { test, expect } from HERE, not @playwright/test)
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

Import `test`/`expect` from **`../helpers/fixtures`** — NOT from `@playwright/test`.
The fixtures module overrides the built-in `request` fixture with a worker-scoped
`APIRequestContext` (so a client built in `beforeAll`/`beforeEach` is reusable in
test bodies — Playwright forbids reusing the default test-scoped `request` that
way) and registers the **per-test DB reset** auto-fixture (see next section).
A spec that imports from `@playwright/test` skips the reset and will be polluted by
other specs' data — always import from the fixtures module.

Use `ProxytraceApiClient` from `../helpers/api-client` to set up prerequisite data
over the API rather than clicking through the UI. **Seed in `beforeEach` (or in the
test body), not `beforeAll`** — the reset runs before every test and wipes
`beforeAll`-seeded content. `beforeAll` is fine only for things the reset keeps
(login token, `firstEndpointId()`/`firstProjectId()` lookups). Group with
`test.describe`.

```ts
import { test, expect } from '../helpers/fixtures';
import { ProxytraceApiClient } from '../helpers/api-client';

test.describe('My Feature', () => {
  let api: ProxytraceApiClient;
  let endpointId: string;

  test.beforeEach(async ({ request }) => {
    api = new ProxytraceApiClient(request);
    const { token } = await api.login('admin@e2e.test', 'E2ePassword1!');
    api.setToken(token);
    endpointId = await api.firstEndpointId();
    // seed THIS test's prerequisite data via api.* here — the DB was just reset
  });

  test('entity appears in the UI', async ({ page }) => {
    const { id } = await api.createAgent({ name: `E2E Agent ${Date.now()}`, endpointId });
    await page.goto('/agents', { waitUntil: 'load' });
    await expect(page.getByTestId(`agent-card-${id}`)).toBeVisible();
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
`api.login('admin@e2e.test', 'E2ePassword1!')` in `beforeEach` and `setToken` it
(the client attaches the Bearer header). Those credentials are the fixed e2e
admin created by setup.

## Test isolation — the DB resets before every core/smoke test

The fixtures module (`helpers/fixtures.ts`) registers an auto-fixture that calls
`POST /api/test/reset` before each `core`/`smoke` test. Reset **truncates all
per-run content** (agents, traces/agent-calls, evaluators, suites, cases, runs,
proposals, invites) but **keeps the setup baseline** (admin user, provider, model,
endpoint, api key, the original project). Each test therefore starts from the same
clean baseline — the way it does when run in isolation.

What this means for your spec:

- **Never depend on data another spec created.** Seed everything your test needs
  itself (in `beforeEach` or the test body). "Reuse an ingested agent if one
  exists" patterns must fall back to seeding one.
- **`beforeAll` seeding is wiped** before the first test. Put seed data in
  `beforeEach`. Keep only reset-surviving lookups (token, endpoint/project ids) in
  `beforeAll` if you use it at all.
- **Don't accumulate state in describe-level `let` counters across tests** — the DB
  resets but JS variables don't. Re-zero them at the top of `beforeEach`.
- **Empty-state / exact-count assertions are now safe** ("0 agents", "page 1 = 20
  rows") because no other spec's data leaks in — but only if you seed exactly what
  you assert and nothing else lingers.

Projects and providers are *kept* across resets (they accumulate), so resolve "the
first/primary project" deterministically with `api.firstProjectId()` (oldest), not
"the newest one". The server seeds into that project and the UI defaults to it.

## Seeding gotchas (cost real debugging time — read once)

- **Agent-version fingerprint is unique per project.** It's a hash of
  `(systemMessage + tools)`. Seeding two agents — or two Agentic evaluators (each
  spins up a backing judge agent) — with the **same** system prompt in the same
  project collides on a unique index and 500s. Give each a unique `systemMessage`
  (the `createAgent` helper already defaults to a unique one; pass a unique value
  when you set it explicitly).
- **`POST /api/test-suites/from-traces` with no evaluators auto-attaches one
  default ExactMatch evaluator** — a suite seeded "with zero evaluators" actually
  has one. Account for it (or pass explicit evaluator ids).
- **Proposal seed `kind` is the `ProposalKind` enum** (`SystemPrompt` / `Tool` /
  `ModelSwitch`) — note it's `Tool`, not `ToolUpdate` (that alias only names the
  details discriminator). And the seed derives a SystemPrompt proposal's *current*
  prompt from the agent's system message, ignoring any client-supplied value — so
  seed against an agent whose prompt you control if you assert on the diff.

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

More flake traps that bit this suite:

- **Don't read a value then assert the opposite after a UI write that races a
  refetch.** An editor draft seeded from a query can be momentarily clobbered when
  the query refetches. If you can verify the result through the API instead, do
  that (set/read via `api.*`, assert the UI *reflects* it). When you must drive the
  UI, wrap the interaction in `await expect(async () => { ...click...; expect(...) }).toPass()`
  so it retries.
- **Strict-mode violations**: `getByText('Name')` matches a card *and* an
  auto-opened detail header → scope it: `page.getByTestId('agent-card-...').toContainText(name)`.
  A modal's submit and a page header can share a label ("Add provider") — use the
  modal's `modal-submit` testid scoped to `modal-panel`, not `getByRole('button', { name })`.
- **`click` times out though the element resolved**: something intercepts pointer
  events (an overlay, or the item sits under a scroll container's rounded border).
  The error log names the intercepting element — fix the component (e.g. pad the
  scroll container) rather than force-clicking.

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

- Imports `test`/`expect` from **`../helpers/fixtures`** (never `@playwright/test`);
  setup uses `ProxytraceApiClient`.
- Seeds its own data (in `beforeEach`/test body, not `beforeAll`) and depends on no
  other spec's data — the DB resets to baseline before every core/smoke test.
- Resolves the primary project via `api.firstProjectId()`; unique `systemMessage`
  per seeded agent/evaluator to avoid fingerprint collisions.
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
