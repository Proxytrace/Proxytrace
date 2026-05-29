# Automated E2E / System Tests — Implementation Plan

## Context

Proxytrace has layered unit tests (MSTest per project) and in-process controller
tests (`Proxytrace.Api.Tests` resolve controllers directly against
`StorageConfiguration.InMemory()`), but **no test exercises the real deployed
stack over the wire**. No Playwright/Cypress, no CI workflow (`.github/workflows`
absent). Goal: true system tests — real built artifacts (frontend + API +
ingestion proxy + Postgres + Redis) booted from a **fresh install**, driven
through the browser, upstream LLM hit for real but gated behind an API key.

### Decisions (confirmed)
- **Scope:** Full browser UI e2e (Playwright drives React → API → DB).
- **Runtime:** Real `docker-compose` stack, fresh DB per run.
- **Upstream LLM:** Real OpenAI, **gated** — LLM-dependent specs skip when no key.

### Key facts (from exploration)
- Full stack in `docker-compose.yml`: `postgres:16` (5432), `redis:7` (6379),
  `api` (`Proxytrace.Api/Dockerfile`, 5100→8080), `proxy`
  (`Proxytrace.Proxy/Dockerfile`, 5102→8080), `frontend` (nginx, 5101→80).
  Frontend nginx (`frontend/nginx.conf`) proxies `/api` → api ⇒ **single
  browser origin `http://localhost:5101`**.
- **Auth** (`Proxytrace.Api/Controllers/AuthController.cs`, `Module.cs:124`
  `ConfigureAuth`):
  - **Local mode** is self-contained, no external IdP. Fresh DB ⇒
    `GET /api/auth/mode` reports `setupRequired:true` ⇒ `POST /api/auth/setup`
    (email+password) creates first admin, returns JWT ⇒ `POST /api/auth/login`.
    **This is the e2e auth path.**
  - **Kiosk mode** bypasses auth but `KioskReadOnlyMiddleware`
    (`Proxytrace.Api/Middleware/KioskReadOnlyMiddleware.cs`) **403s every
    non-GET** ⇒ cannot test create flows ⇒ **must run `Kiosk:Enabled=false`**.
- **Fresh DB:** `DatabaseInitializationService`
  (`IDatabaseInitializer.EnsureDatabaseReadyAsync`) creates schema on boot;
  `DemoSeederHostedService` seeds demo scenarios. True fresh-install e2e runs
  **without demo seeding**; specs create their own data via the UI.
- **Ingestion path:** client → proxy (5102 `/openai/v1`, Proxytrace API key) →
  forwards upstream (real LLM, gated) → publishes to Redis → api consumes →
  trace surfaces in UI. Headline e2e flow.
- Upstream stub used by in-process tests:
  `FakeHttpMessageHandler.BuildOpenAiResponse` (`Proxytrace.Api.Tests`) — not
  used by the compose stack, but documents the upstream contract.

## Approach

Dedicated top-level **`e2e/`** Playwright (TypeScript, `@playwright/test`)
workspace that boots the real compose stack against a throwaway DB and drives
the browser. Separate from `frontend/` because it tests the whole deployed
system, not the SPA in isolation.

### 1. E2E compose overlay — `docker-compose.e2e.yml`
Override layered on `docker-compose.yml`:
- Force `Kiosk__Enabled=false`, `Authentication__Mode=Local`, fixed test-only
  `Authentication__Local__SigningKey` on `api`.
- Disable demo seeding (fresh install).
- Pass `ModelProvider__UpstreamBaseUrl` through (default real OpenAI).
- Add **healthchecks** so `--wait` is reliable:
  - postgres: `pg_isready`
  - api: `GET /api/health` (confirm exact route in `HealthController` during impl)
- Ephemeral pg volume (or none) ⇒ every run starts empty.

Fresh-run command:
`docker compose -f docker-compose.yml -f docker-compose.e2e.yml down -v && \
 docker compose -f docker-compose.yml -f docker-compose.e2e.yml up --build -d --wait`

### 2. `e2e/` Playwright project
- `e2e/package.json` — `@playwright/test` only.
- `e2e/playwright.config.ts` — `baseURL: http://localhost:5101`, projects:
  - **`setup`** (global): first-admin setup + login once, save
    `storageState.json` (session JWT in localStorage / header).
  - **`core`** — authenticated UI/CRUD specs (depend on `setup` storageState).
  - **`@llm`-tagged** specs — `test.skip(!process.env.OPENAI_API_KEY)` (gated).
- `e2e/global-setup.ts` — drive `/api/auth/mode` → `/api/auth/setup`, persist
  session, assert `setupRequired` was true (proves fresh DB).

### 3. Spec coverage (priority order)
1. **`auth.setup.spec.ts`** — fresh install: setup wizard creates first admin,
   redirects to dashboard, session persists on reload.
2. **`core-crud.spec.ts`** — create Project, ModelProvider, ModelEndpoint, API
   key, Agent through the UI; assert list/persist (read-back from API).
3. **`ingestion.spec.ts` `@llm`** — using the issued Proxytrace key, send an
   OpenAI-compatible request to the proxy (5102 `/openai/v1`), assert the trace
   appears in the Traces UI (poll via SSE/refresh). Exercises
   proxy→Redis→consumer→UI.
4. **`test-run.spec.ts` `@llm`** — build TestSuite + TestCase, attach evaluator,
   run against an agent, assert results render.
5. **`smoke.spec.ts`** — dashboard, traces, agents, suites, proposals routes
   load without console errors.

Helpers in `e2e/helpers/` for API-key creation and trace polling; reuse DTO
field names from `frontend/src/api/*.ts`.

### 4. CI — `.github/workflows/e2e.yml`
- Build images, `up --wait` the e2e overlay (fresh volumes), `npx playwright test`.
- Inject `OPENAI_API_KEY` from repo secret; absent (forks) ⇒ `@llm` specs skip,
  core/smoke still run.
- Upload Playwright HTML report + traces on failure; always `down -v`.

### 5. Convenience script — `e2e/run.sh`
Fresh `down -v` → `up --wait` → `playwright test` → teardown, mirrors CI locally.

## Files to create
- `docker-compose.e2e.yml` (root)
- `e2e/package.json`, `e2e/playwright.config.ts`, `e2e/global-setup.ts`
- `e2e/tests/*.spec.ts`, `e2e/helpers/*.ts`
- `e2e/run.sh`
- `.github/workflows/e2e.yml`

## Files to touch (small)
- `docker-compose.yml` — add postgres/api healthchecks for `--wait` (or isolate
  in the overlay to leave prod compose untouched).
- `manual/admin/` — new page on running the e2e suite (CLAUDE.md: manual stays
  in sync); wire into `manual/.vitepress/config.ts`.

## Verification
1. **Fresh-install proof:** `down -v` then `up --build -d --wait`; confirm
   `GET /api/auth/mode` returns `setupRequired:true` on the empty DB.
2. **Core (no key):** `cd e2e && npx playwright test --grep-invert @llm` — setup,
   CRUD, smoke green; storageState created.
3. **Full (with key):** `OPENAI_API_KEY=... npx playwright test` — ingestion +
   test-run `@llm` specs green; real trace appears in UI.
4. **Gating:** unset key ⇒ `@llm` specs skipped, suite still passes.
5. **CI:** workflow green on a PR; HTML report artifact present; stack torn down
   with `down -v`.
6. Existing tests unaffected: `dotnet test Proxytrace.sln`, `cd frontend &&
   npm run build && npm test`.

## Open implementation details (resolve during build)
- Exact health route; consider `/api/health/ready` reflecting DB + Redis for the
  compose healthcheck.
- SPA local-mode JWT storage key (localStorage) so global-setup can seed
  `storageState` — from `frontend/src/api/client.ts` / auth provider.
- Optional seed toggle so a spec can opt into demo data vs default empty DB.
