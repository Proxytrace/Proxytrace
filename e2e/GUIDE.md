# E2E Testing Guide

This guide covers when to write E2E tests, how to structure them, selectors, auth, the LLM gate, and running/debugging locally.

---

## When to write an E2E test

| Scenario | Test type |
|----------|-----------|
| New CRUD flow (create/read/update/delete an entity) | `core-crud.spec.ts` or new spec in `tests/` |
| New top-level route | `smoke.spec.ts` — add it to `ROUTES` |
| Flow that crosses proxy → Redis → API → UI | `ingestion.spec.ts` (or new `@llm` spec) |
| Flow that requires a real LLM call | Tag with `@llm`, gate with `test.skip(!process.env.OPENAI_API_KEY, ...)` |
| Pure UI logic or a formatter | **Unit test** (`*.spec.ts` in `frontend/src/`) — not E2E |
| A component renders correctly | **Unit test** — not E2E |

E2E tests cost minutes per run and require a live stack. Reserve them for **flows that cross a process boundary** (browser → API → DB, or proxy → Redis → API → UI). Unit-test everything else.

---

## Project structure

```
e2e/
  playwright.config.ts      ← four projects: setup, core, smoke, llm
  run.sh                    ← local: down -v → up --wait → test → down -v
  tests/
    auth.setup.spec.ts      ← runs once; creates first admin; saves storageState
    smoke.spec.ts           ← all main routes load clean (no console errors)
    core-crud.spec.ts       ← CRUD flows via API + UI verification
    ingestion.spec.ts       ← @llm: proxy → Redis → API → Traces UI
    test-run.spec.ts        ← @llm: suite + case + evaluator + run → Runs UI
  helpers/
    api-client.ts           ← ProxytraceApiClient: typed wrappers for all API calls
  .auth/
    storageState.json       ← saved by auth.setup.spec.ts; gitignored
```

The **`setup` project** runs `auth.setup.spec.ts` first. All other projects declare `dependencies: ['setup']` in `playwright.config.ts` and load `.auth/storageState.json` — you start every test already authenticated.

---

## Writing a new spec

### Step 1: Decide which file

- **New CRUD entity or admin flow** → add `test.describe` block to `core-crud.spec.ts`, or create `tests/<feature>.spec.ts` and add it to the `core` project's `testMatch` in `playwright.config.ts`.
- **New route** → add one entry to `ROUTES` in `smoke.spec.ts`.
- **LLM-dependent** → create `tests/<feature>.spec.ts`, add to the `llm` project's `testMatch`, and gate with `test.skip`.

### Step 2: Use `ProxytraceApiClient` for setup

Avoid navigating through the UI to create prerequisites. Use the API client in `beforeAll` so tests are fast and don't depend on other UI flows:

```typescript
import { test, expect } from '@playwright/test';
import { ProxytraceApiClient } from '../helpers/api-client';

test.describe('My Feature', () => {
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    const api = new ProxytraceApiClient(request);
    const { token } = await api.login('admin@e2e.test', 'E2ePassword1!');
    authToken = token;
    api.setToken(token);
    // create prerequisite data via API here
  });

  test('entity appears in UI', async ({ page }) => {
    await page.goto('/my-route', { waitUntil: 'load' });
    await expect(page.getByTestId('my-feature-list')).toBeVisible();
  });
});
```

### Step 3: Register new API calls

If your feature calls a backend endpoint not yet in `helpers/api-client.ts`, add a method there. Follow the existing pattern: typed request/response, throw on `!res.ok()`.

```typescript
async createFoo(name: string): Promise<{ id: string }> {
  const res = await this.request.post('/api/foos', {
    headers: this.headers(),
    data: { name },
  });
  if (!res.ok()) throw new Error(`create foo failed: ${res.status()} ${await res.text()}`);
  return res.json();
}
```

---

## Selectors — what to use and why

Playwright provides several selector strategies. Use them in this priority order:

### 1. `data-testid` (preferred for most assertions)

```tsx
// In the component:
<button data-testid="provider-create-btn" onClick={onCreate}>
  New Provider
</button>

// In the test:
await expect(page.getByTestId('provider-create-btn')).toBeVisible();
await page.getByTestId('provider-create-btn').click();
```

`data-testid` survives text changes, refactors, and i18n. See the naming convention below.

### 2. ARIA role + accessible name (for interactive elements)

```tsx
// In the component:
<button aria-label="Delete provider">...</button>

// In the test:
await page.getByRole('button', { name: 'Delete provider' }).click();
```

Use this for icons and controls that have a meaningful label but no `data-testid`.

### 3. `getByText` (for non-interactive content verification only)

```tsx
// Good — asserting a value is displayed:
await expect(page.getByText('E2E Test Provider')).toBeVisible();

// Avoid — clicking by text; text changes break this:
await page.getByText('New Provider').click(); // ← fragile
```

Use `getByText` to assert content is present. Use `getByRole` or `getByTestId` to interact.

### 4. `getByRole('navigation')`, `getByRole('list')`, etc.

Useful for structural smoke tests:

```typescript
await expect(page.getByRole('navigation')).toBeVisible();
await expect(page.getByRole('list', { name: 'providers' })).toBeVisible();
```

---

## `data-testid` naming convention

```
<entity>-<element-type>[-<qualifier>]
```

| Pattern | Example | Used on |
|---------|---------|---------|
| `<entity>-list` | `provider-list` | The list/table container |
| `<entity>-row-<id>` | `provider-row-{provider.id}` | Individual row/card (dynamic) |
| `<entity>-create-btn` | `provider-create-btn` | Primary create/add button |
| `<entity>-edit-btn-<id>` | `provider-edit-btn-{id}` | Per-row edit trigger |
| `<entity>-delete-btn-<id>` | `provider-delete-btn-{id}` | Per-row delete trigger |
| `<entity>-name` | `provider-name` | Text display of entity name |
| `<feature>-empty-state` | `provider-empty-state` | Empty state component |
| `<feature>-loading` | `provider-loading` | Loading skeleton |

Dynamic IDs belong in the qualifier: `data-testid={\`provider-row-${provider.id}\`}`.

Keep IDs **stable across code changes**. The ID is a public API contract between the component and the test.

---

## Authentication

The `setup` project runs first and saves a browser session (localStorage `proxytrace.token`) to `.auth/storageState.json`. All `core`, `smoke`, and `llm` tests load this state automatically via `playwright.config.ts`.

You do **not** need to navigate to `/login` or call the auth API in individual tests — the `page` fixture already has a valid session.

For **API calls inside tests** (via `request` fixture), the storageState does not inject Bearer headers. Use `ProxytraceApiClient.login()` in `beforeAll` to get a token and set it on the client:

```typescript
test.beforeAll(async ({ request }) => {
  const api = new ProxytraceApiClient(request);
  const { token } = await api.login('admin@e2e.test', 'E2ePassword1!');
  api.setToken(token);
  // api calls now include Authorization: Bearer <token>
});
```

---

## LLM-gated tests

Tests that send a real request to OpenAI must be gated. The `llm` project runs them; CI skips them when `OPENAI_API_KEY` is absent.

```typescript
test.describe('@llm my feature', () => {
  // This line must be the first statement inside describe:
  test.skip(!process.env.OPENAI_API_KEY, 'requires OPENAI_API_KEY env var');

  // ... tests
});
```

Rules:
- Gated specs live in `tests/ingestion.spec.ts`, `tests/test-run.spec.ts`, or a new file matched by the `llm` project.
- Never put LLM-dependent assertions inside `core` or `smoke` specs.
- Always poll for async side-effects (`expect.poll`) rather than a fixed `waitForTimeout`.

---

## Polling for async results

When a side-effect is eventually consistent (trace ingestion, test run completion), poll instead of sleeping:

```typescript
// ✅ correct
await expect.poll(
  async () => {
    const result = await api.getTestRun(runId);
    return result.status;
  },
  { timeout: 60_000, intervals: [3_000], message: 'run did not complete' },
).toMatch(/Completed|Failed/);

// ❌ wrong — fragile, hides actual timing
await page.waitForTimeout(5000);
```

---

## `waitUntil` — always `'load'`, never `'networkidle'`

Proxytrace opens SSE connections after page load (live trace streaming, test result updates). These persistent connections **prevent `networkidle`** from ever resolving. Use `'load'` instead:

```typescript
await page.goto('/traces', { waitUntil: 'load' });
await page.reload({ waitUntil: 'load' });
```

If you need to wait for data to appear after navigation, wait for a specific element:

```typescript
await page.goto('/traces', { waitUntil: 'load' });
await expect(page.getByTestId('trace-list')).toBeVisible();
```

---

## Running tests locally

### Full suite (with stack boot)

```bash
bash e2e/run.sh
```

This tears down any existing stack, rebuilds, waits for healthy services, runs all tests, and tears down again.

### With LLM specs

```bash
OPENAI_API_KEY=sk-... bash e2e/run.sh
```

### Subset (stack already running)

```bash
cd e2e
npx playwright test --project=smoke
npx playwright test --project=core
npx playwright test --project=llm
npx playwright test tests/core-crud.spec.ts
```

### Interactive / headed mode

```bash
cd e2e
npx playwright test --headed --project=core
```

### Playwright Inspector (step through test)

```bash
cd e2e
PWDEBUG=1 npx playwright test tests/core-crud.spec.ts
```

### View report after failure

```bash
cd e2e && npm run report
```

---

## Stack prerequisites

The e2e tests require the compose stack to be running. Start it with:

```bash
docker compose -f docker-compose.yml -f docker-compose.e2e.yml down -v
docker compose -f docker-compose.yml -f docker-compose.e2e.yml up --build -d --wait
```

The `--wait` flag blocks until all healthchecks pass (postgres `pg_isready`, api/proxy `GET /health`). This typically takes 20–40 seconds on first build.

**Important:** Always `down -v` before re-running. The auth setup spec asserts `setupRequired: true`, which requires a fresh (empty) database. If you skip `down -v`, the setup spec will fail.

---

## Adding a new spec file to a project

If you create `tests/my-feature.spec.ts` and it needs to run as part of `core`:

1. Open `playwright.config.ts`
2. Find the `core` project's `testMatch`
3. Update it to include your file, e.g.:
   ```typescript
   testMatch: /core-crud\.spec\.ts|my-feature\.spec\.ts/,
   ```

Or use a glob pattern that matches all non-LLM specs automatically — see `playwright.config.ts` for the current approach.

---

## CI behavior

The GitHub Actions workflow (`.github/workflows/e2e.yml`) runs:

- **Always:** `setup` (via dependency) + `core` + `smoke`
- **Only when `OPENAI_API_KEY` secret is set:** `llm`

On failure, the Playwright HTML report is uploaded as a build artifact (`playwright-report`). Download it from the Actions run to see screenshots and traces.
