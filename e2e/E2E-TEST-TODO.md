# E2E Test Implementation Checklist

Each unchecked box below is **one concrete Playwright test to implement** — named
by the flow it covers, with the route, the action to drive, and the assertion to
make. Check it off when the spec is written, wired into a `playwright.config.ts`
project, and run green.

Read `e2e/GUIDE.md` + the `create-e2e-test` skill first. Conventions for every
item: `data-testid`-first selectors, prerequisite data via `ProxytraceApiClient`
(add a typed method if missing), `waitUntil: 'load'`, `expect.poll` for async,
no `waitForTimeout`, `@llm`-tag + `test.skip(!OPENAI_API_KEY)` for real-LLM work.

---

## 1. Smoke — every route loads clean (no LLM)
File: extend `smoke.spec.ts` `ROUTES` array.

- [ ] `/runs` loads, nav visible, zero console errors
- [ ] `/evaluators` loads, zero console errors
- [ ] `/playground` loads, zero console errors
- [ ] `/evaluator-playground` loads, zero console errors
- [ ] `/settings` loads, zero console errors
- [ ] `/dashboard` (currently only `/` is checked) loads, zero console errors
- [ ] `/admin/invites` loads for an admin user, zero console errors
- [ ] unknown path `/does-not-exist` redirects to `/dashboard`

## 2. Providers (no LLM)
File: extend `core-crud.spec.ts` or new `providers.spec.ts`. Page `/providers`.

- [ ] Create provider via `AddProviderModal` (click create → fill name/baseUrl →
      submit) → new row appears in `ProviderList`
- [ ] Open `ProviderDetail` → header shows provider name + model count
- [ ] Add a model under provider (`ModelsTab`) → model appears in the models list
- [ ] Issue an API key (`KeysTab`) → key value is shown once and the key is listed
- [ ] Revoke/delete an API key → key disappears from `KeysTab`
- [ ] Delete a provider → row removed from `ProviderList`, redirect to list
- [ ] Empty state renders on a project with no providers

## 3. Agents (no LLM)
File: extend `agents.spec.ts`. Page `/agents`.

- [ ] Create an agent (name + system prompt + endpoint via `EndpointSelector`) →
      appears in `AgentList`
- [ ] Open `AgentDetail` → name, system prompt, selected endpoint render
- [ ] Edit an agent's system prompt → change persists on reload
- [ ] Editing the system prompt records a new version in `VersionsWidget`
      (`AgentVersionsController`) → version count increments, history lists it
- [ ] Roll back / view a prior agent version → prompt reverts to that version
- [ ] Add a tool spec to an agent → tool appears in `AgentDetail`
- [ ] Delete an agent → removed from list; empty state returns when last is gone

## 4. Test Suites & Test Cases (no LLM)
File: new `suites.spec.ts`. Page `/suites`. Add `createTestCase`/`getTestSuite`
to api-client.

- [ ] Create a suite via `CreateSuiteWizard` end-to-end: Name step → Agent step →
      Traces step → Evaluators step → suite appears as a `SuiteCard`
- [ ] `SuiteCard` shows correct test-case count and evaluator count
- [ ] Edit a suite via `EditSuiteDialog` (rename) → name updates on the card
- [ ] Attach an evaluator to an existing suite → evaluator count increments
- [ ] Detach an evaluator from a suite → count decrements
- [ ] Add a test case to a suite → case count increments
- [ ] Delete a suite → card removed; empty state when none remain

## 5. Traces → Test Case promotion (no LLM; seed traces via API)
File: new `traces.spec.ts`. Page `/traces`. Seed `AgentCall`s via api-client.

- [ ] `TraceTable` lists seeded traces (correct row count)
- [ ] Click a trace row → `TraceDetail` drawer opens with messages
      (`TraceMessagesTab`) and metadata (`TraceMetadataTab`)
- [ ] `AgentFilterCards` filter narrows the table to one agent's traces
- [ ] Conversation grouping toggle switches `ConversationGroupRow` ↔ `FlatTraceRow`
- [ ] Promote a trace via `PromoteModal`: select a suite → submit → the suite's
      test-case count increases by one (verify via API read-back)
- [ ] Pagination: with > pageSize seeded traces, next page shows the next set

## 6. Evaluators CRUD, per kind (no LLM for rule kinds)
File: new `evaluators.spec.ts`. Page `/evaluators`. `NewEvaluatorModal` →
`KindPickerCard` → `EvaluatorForm`.

- [ ] Create an **ExactMatch** evaluator → appears in `EvalRail`, `EvaluatorDetail`
      shows its definition (`DefinitionPanel`)
- [ ] Create a **NumericMatch** evaluator → definition renders correctly
- [ ] Create a **JsonSchemaMatch** evaluator (paste schema) → schema shown in
      `NumberedCode`
- [ ] Create a **ToolUsage** evaluator → definition renders
- [ ] Edit an evaluator's config → change persists
- [ ] `AttachedPanel` lists which suites use the evaluator
- [ ] Delete an evaluator → removed from `EvalRail`; `EmptyDetail` shown
- [ ] `/evaluators/:id` deep-link opens that evaluator's detail directly

## 7. Test Runs & results UI
File: extend `test-run.spec.ts` (already `@llm`). Page `/runs`.

- [ ] (`@llm`) After a run completes, `GroupListCard` shows the group with status
      Completed (already partly covered — assert the card, not just status)
- [ ] (`@llm`) Open `GroupDetail` → `MatrixView` shows one column per endpoint and
      one row per test case
- [ ] (`@llm`) `CaseTile` colors reflect pass/fail per case (`CaseDotLegend`)
- [ ] (`@llm`) `RunDetail` for a single case shows per-evaluator scores
- [ ] (`@llm`) `EvaluatorHeatmap` renders a cell per evaluator×case
- [ ] (`@llm`) `ModelLeaderboard` ranks endpoints when a suite runs against 2+
      endpoints (`createTestRunGroup` with two `modelEndpointIds`)
- [ ] (`@llm`) `RunConfirmModal` → confirm starts a run from the suites page;
      run group appears under `/runs`

## 8. Dashboard statistics (no LLM; seed data via API)
File: new `dashboard.spec.ts`. Page `/dashboard`. Add `getStatistics` to api-client.

- [ ] `StatTileGrid` tiles reflect seeded counts (traces / agents / runs)
- [ ] `HeroTokenCard` shows non-zero total tokens after seeding traces with usage
- [ ] `PassRateGauge` shows a pass rate after a completed run exists
- [ ] `TokenByAgentSection` lists per-agent token usage for seeded agents
- [ ] `LatencySection` renders latency stats from seeded traces
- [ ] `LiveTraceStream` appends a new row when a trace is ingested (SSE) —
      assert via `expect.poll` on row count after an API-ingested call

## 9. Proposals (seeded = no LLM; generation = `@llm`)
File: extend `proposals.spec.ts`. Page `/proposals`. Feature-gated route.

- [ ] Seeded proposal renders as a `ProposalCard` with its status (covered —
      keep)
- [ ] Open `ProposalDetail` → `ProposalHeader`, `EvidenceList`, `PredictedImpactBand`
      render
- [ ] `PromptDiff` shows old vs new system prompt for an UpdateSystemPrompt proposal
- [ ] `ModelSwitchSection` shows from→to model for a SwitchModel proposal
- [ ] Approve via `ProposalActionBar` → status flips to Approved (verify API read-back)
- [ ] Reject via `ProposalActionBar` → status flips to Rejected, `ProposalTerminalNote`
      shown
- [ ] (`@llm`) Generate a real proposal for an agent with run evidence → poll until
      it appears as a `ProposalCard`

## 10. Playground (`@llm`)
File: new `playground.spec.ts`. Page `/playground`.

- [ ] (`@llm`) Pick an agent (`AgentPicker`) + endpoint (`EndpointPicker`), type a
      prompt in `ComposeBox`, send → assistant reply renders in `ConversationView`
- [ ] (`@llm`) `CompletionStats` shows token usage + latency after a reply
- [ ] (`@llm`) `AddMessageBar` adds a follow-up turn → multi-turn conversation works
- [ ] `ParameterSlider` (temperature) changes are reflected in the request payload
      (assert via captured trace, no real send needed if mockable — else `@llm`)
- [ ] `EditableMessageBubble` lets you edit a prior user message before re-sending

## 11. Evaluator Playground / Test Bench (`@llm`)
File: new `evaluator-playground.spec.ts`. Page `/evaluator-playground`.
`EvaluatorTestBenchController`.

- [ ] (`@llm`) Pick a test result (`TestResultPicker`) + an LLM evaluator, run the
      bench → `TestBenchResult` shows the verdict/score in `TestBenchPanes`
- [ ] (`@llm`) Run a rule-based evaluator (ExactMatch) on a sample → deterministic
      pass/fail shown (this one need not be `@llm` if no model call)

## 12. Settings (no LLM)
File: new `settings.spec.ts`. Page `/settings`.

- [ ] `ProjectsTab` lists existing projects with member/status cells
- [ ] Create a project via `NewProjectModal` → appears in `ProjectsTab`
- [ ] Add a member via `AddMemberModal` → member row appears with status
- [ ] `SearchIndexingTab`: trigger reindex → status reflects indexing
      (`SearchController`)
- [ ] `DangerZoneTab`: delete project requires confirmation → after confirm,
      project removed and user redirected
- [ ] `ToggleRow` feature flags persist across reload

## 13. Admin / Invites (no LLM; admin role)
File: new `admin.spec.ts`. Page `/admin/invites`. Route is `isAdmin`-gated.
Add `createInvite`/`revokeInvite`/`listInvites` to api-client.

- [ ] Admin issues an invite → invite appears in the list with pending status
- [ ] Admin revokes an invite → invite removed / marked revoked
- [ ] Non-admin user hitting `/admin/invites` is redirected (not shown the page)

## 14. Auth & access control (no LLM; separate non-storageState specs)
File: new `auth-flows.spec.ts`. Do NOT load the shared storageState here.

- [ ] Valid login (`/login`) lands on `/dashboard`
- [ ] Invalid password shows an error and stays on `/login`; no token issued
- [ ] Logged-out user hitting a protected route (`/agents`) is redirected to `/login`
- [ ] Logout returns to `/login` and clears the session
- [ ] (local mode) Signup (`/signup`) creates a user and logs in
- [ ] Optimization-proposals route gated to HTTP 402 on Free tier (covered in
      `licensing.spec.ts` — keep)

## 15. Negative / error paths (no LLM)
File: new `error-handling.spec.ts`. `ErrorHandlingController`.

- [ ] Unknown API route returns 404 with the standard error shape (`{ request }`)
- [ ] Invalid create payload (e.g. blank agent name) returns 400 with validation
      details; UI shows the field error rather than crashing
- [ ] A failed list query renders a friendly error/empty state, not a blank page

---

## `ProxytraceApiClient` methods to add (consolidated)
Add each as a typed method that throws on `!res.ok()`, matching existing style;
confirm path/body against `frontend/src/api/*.ts` or the controller.

- [ ] `createAgent`, `getAgent`, `deleteAgent`, `getAgentVersions`
- [ ] `createTestCase`, `getTestSuite`
- [ ] `addModelToProvider`, `revokeApiKey`, `deleteProvider`
- [ ] `getStatistics`
- [ ] `search`, `reindexSearch`
- [ ] `createProject`, `inviteUser`, `revokeInvite`, `listInvites`
- [ ] `getConfig`
- [ ] `runEvaluatorTestBench`
