# E2E Test Coverage TODO

A prioritized backlog for growing the Playwright e2e suite under `e2e/`. Read
`e2e/GUIDE.md` and the `create-e2e-test` skill before picking up an item, and
copy the closest existing spec.

## Conventions for every item below
- Spec lives in `e2e/tests/<feature>.spec.ts`; wire it into a project's
  `testMatch` in `playwright.config.ts` (and `dependencies` if it needs another
  spec's data).
- Set up prerequisite data via `ProxytraceApiClient`; add a typed method when one
  is missing (note the methods to add per item).
- `data-testid`-first selectors; if an id is missing, add a stable one in the
  React component per `frontend/BEST_PRACTICES.md`.
- `waitUntil: 'load'`, `expect.poll` for async, never `waitForTimeout`.
- Real-LLM work is `@llm`-tagged + `test.skip`-gated; keep it out of core/smoke.

## Coverage snapshot (2026-05-30)

Covered today: first-admin setup, 6-route smoke, provider/endpoint/project
read-back CRUD, agents empty+list, seeded proposals, free-tier licensing gates,
and three `@llm` flows (proxy ingestion, trace→drawer, test run completes).

Untested controllers: `AgentVersions`, `Config`, `EvaluatorTestBench`, `Search`,
`Statistics`, `Users`, `TestCases` (UI), and most negative/error paths.
Untested routes: `/runs`, `/evaluators`, `/playground`, `/evaluator-playground`,
`/settings`, `/admin`.

---

## P0 — cheap, high-value, no LLM required

- [ ] **Extend smoke to all routes.** Add `/runs`, `/evaluators`, `/playground`,
  `/evaluator-playground`, `/settings`, `/admin` to `ROUTES` in `smoke.spec.ts`.
  No config change needed. Catches console errors / broken lazy chunks per page.
- [ ] **Provider create via UI wizard.** Drive the providers create flow in the
  browser (not just API read-back), assert the new provider row appears.
  May need `provider-create-btn` / `provider-row-<id>` testids.
- [ ] **Agent CRUD via UI.** Create → edit → delete an agent through the app;
  assert list + empty-state transitions. Add `createAgent`/`deleteAgent` to
  `api-client.ts` for prerequisite/cleanup. Builds on existing `agents.spec.ts`.
- [ ] **Test suite + test case CRUD via UI.** Create a suite, add a test case,
  attach an evaluator, verify on `/suites`. `createTestSuite` exists; add
  `createTestCase` / `getTestSuite` methods.
- [ ] **Evaluator CRUD via UI.** `/evaluators` page: create each evaluator kind
  (exact-match, numeric, json-schema, tool-usage at minimum), edit, delete.
  `createEvaluator` exists for one kind — generalize it.

## P1 — fills untested controllers / routes (no LLM)

- [ ] **Dashboard statistics.** `/` KPIs from `StatisticsController` reflect
  seeded data (trace count, agent count, run count). Add `getStatistics` client
  method; seed via API then assert KPI cards.
- [ ] **Global search.** `SearchController` + search UI: index seeded entities,
  search by name, assert results navigate correctly. Covers `SearchIndexingTab`
  in settings too. Add `search` client method.
- [ ] **Settings — projects tab.** Create a new project via `NewProjectModal`,
  add a member via `AddMemberModal`, verify in `ProjectsTab`. Touches
  `ProjectsController` + `UsersController`.
- [ ] **Settings — danger zone.** Project delete confirmation flow
  (`DangerZoneTab`); assert guarded action + post-delete redirect.
- [ ] **Admin invites.** `/admin` `Invites.tsx`: issue an invite, list it,
  revoke it. Covers `UsersController` invite endpoints. Add client methods.
- [ ] **Agent versioning.** `AgentVersionsController`: edit an agent's system
  prompt, assert a new version is recorded and the version history UI shows it.
- [ ] **Config endpoint.** Assert `ConfigController` surfaces expected
  feature/runtime flags consumed by the frontend (pure API spec, `{ request }`).

## P2 — negative paths & auth hardening

- [ ] **Auth — login/logout UI.** Separate (non-storageState) spec: valid login
  lands on dashboard; logout returns to `/login`; protected route while logged
  out redirects to `/login`.
- [ ] **Auth — invalid credentials.** Wrong password / unknown user shows an
  error and stays on `/login`; no token issued.
- [ ] **Error handling.** `ErrorHandlingController`: 404 on unknown API route,
  validation error shape on a bad create payload, friendly UI error/empty states
  when an API call fails.
- [ ] **Authorization.** Non-admin user blocked from `/admin` and admin-only API
  endpoints (HTTP 403); needs a second seeded user role.
- [ ] **Pagination & filtering.** Traces / runs list pagination and filter
  controls with enough seeded rows to page (`getAgentCalls` supports paging).

## P3 — `@llm`-gated deeper flows

- [ ] **Playground round-trip** (`@llm`). `/playground` + `PlaygroundController`:
  send a prompt to a configured endpoint, assert streamed response renders.
  Tag `@llm`, gate on `OPENAI_API_KEY`, bump `test.setTimeout`.
- [ ] **Evaluator test bench / playground** (`@llm`). `EvaluatorTestBenchController`
  + `/evaluator-playground`: run an LLM-based evaluator (helpfulness/safety) on a
  sample, assert the verdict renders.
- [ ] **Optimization proposal generation** (`@llm`). Beyond the seeded proposal:
  trigger real proposal generation for an agent with run evidence, poll until it
  appears, then approve/reject and assert status change persists.
- [ ] **Test run detail UI** (`@llm`). Extend `test-run.spec.ts`: open the
  `GroupDetail` / `RunDetail` / `MatrixView`, assert per-case results and
  per-evaluator scores render, and the comparison matrix is populated.
- [ ] **Multi-endpoint run comparison** (`@llm`). Run one suite against two model
  endpoints; assert the matrix shows both columns with independent results.

---

## `ProxytraceApiClient` methods to add (consolidated)

`createAgent`, `deleteAgent`, `getAgent`, `createTestCase`, `getTestSuite`,
`getStatistics`, `search`, `createProject` (UI uses modal; API helper for setup),
`inviteUser` / `revokeInvite`, `getAgentVersions`, `getConfig`. Add each as a
typed method that throws on `!res.ok()`, matching existing style; confirm the
path/body against `frontend/src/api/*.ts` or the controller.
