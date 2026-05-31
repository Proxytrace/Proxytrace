# E2E Test Implementation Checklist

Status: implemented across the Playwright suite under `e2e/`. Each box is checked when the
spec is written, wired into a `playwright.config.ts` project, and type-checks clean. The full
live-stack run requires Docker (`bash e2e/run.sh`); items marked **(@llm)** also need
`OPENAI_API_KEY`. A handful of items are **not buildable** against the current product surface
and are left unchecked with the reason inline — see "Known gaps" at the bottom.

Conventions used for every item: `data-testid`-first selectors, prerequisite data via
`ProxytraceApiClient` (typed methods added in `helpers/api-client.ts`), `waitUntil: 'load'`,
`expect.poll` for async, no `waitForTimeout`, `@llm`-tag + `test.skip(!OPENAI_API_KEY)` for
real-LLM work.

---

## 1. Smoke — every route loads clean (no LLM) — `smoke.spec.ts`
- [x] `/runs` loads, nav visible, zero console errors
- [x] `/evaluators` loads, zero console errors
- [x] `/playground` loads, zero console errors
- [x] `/evaluator-playground` loads, zero console errors
- [x] `/settings` loads, zero console errors
- [x] `/dashboard` loads, zero console errors
- [x] `/admin/invites` loads for an admin user, zero console errors
- [x] unknown path `/does-not-exist` redirects to `/dashboard`

## 2. Providers (no LLM) — `providers.spec.ts`
- [x] Create provider via `AddProviderModal` → new row appears in `ProviderList`
- [x] Open `ProviderDetail` → header shows provider name + model count
- [x] Add a model under provider (`ModelsTab`) → model appears in the models list
- [x] Issue an API key (`KeysTab`) → key value shown once and the key is listed
- [x] Revoke/delete an API key → key disappears from `KeysTab`
- [x] Delete a provider → row removed, redirect to list
- [x] Empty state renders on a project with no providers (defensive skip on the shared tenant)

## 3. Agents (no LLM) — `agents.spec.ts`
- [x] Empty state when there are no agents; list renders created agents
- [x] Open `AgentDetail` → name, system prompt, selected endpoint render
- [ ] Edit an agent's system prompt → persists — **no UI edit/API path** (read-only widget)
- [ ] Editing the prompt records a new version — **versions only created by ingestion pipeline**
- [ ] Roll back / view a prior version — **only "move version" exists, no in-place rollback**
- [ ] Add a tool spec to an agent — **tools are read-only; created via ingestion only**
- [x] Delete an agent → removed from list; empty state returns when last is gone

## 4. Test Suites & Test Cases (no LLM) — `suites.spec.ts`
- [x] Create a suite via `CreateSuiteWizard` end-to-end → suite appears as a `SuiteCard`
- [x] `SuiteCard` shows correct test-case count and evaluator count
- [x] Edit a suite via `EditSuiteDialog` (evaluator edit; **rename has no endpoint — PUT ignores name**)
- [x] Attach an evaluator to an existing suite → evaluator count increments
- [x] Detach an evaluator from a suite → count decrements
- [x] Add a test case to a suite → case count increments
- [x] Delete a suite → card removed; empty state when none remain

## 5. Traces → Test Case promotion (no LLM; seed traces via API) — `traces.spec.ts`
- [x] `TraceTable` lists seeded traces (correct row count)
- [x] Click a trace row → `TraceDetail` drawer opens with messages + metadata tabs
- [x] `AgentFilterCards` filter narrows the table to one agent's traces
- [x] Conversation grouping — seed endpoint now accepts `conversationId`; multi-turn traces render
      as an expandable `ConversationGroupRow` (`traces-grouping.spec.ts`)
- [x] Promote a trace via `PromoteModal` → the suite's test-case count increases by one
- [x] Pagination: with > pageSize seeded traces, next page shows the next set

## 6. Evaluators CRUD, per kind (no LLM for rule kinds) — `evaluators.spec.ts`
- [x] Create an **ExactMatch** evaluator → appears in `EvalRail`, detail shows definition
- [x] Create a **NumericMatch** evaluator → definition renders correctly
- [x] Create a **JsonSchemaMatch** evaluator → schema shown in `NumberedCode`
- [ ] Create a **ToolUsage** evaluator — **not in the API/UI: only Agentic/ExactMatch/NumericMatch/JsonSchemaMatch exist**
- [x] Edit an evaluator's config → change persists
- [x] `AttachedPanel` lists which suites use the evaluator
- [x] Delete an evaluator → removed from `EvalRail`
- [x] `/evaluators/:id` deep-link opens that evaluator's detail directly

## 7. Test Runs & results UI — `test-run.spec.ts` (@llm)
- [x] (@llm) Completed run shows the group card with status Completed
- [x] (@llm) `GroupDetail` → `MatrixView` column per endpoint, row per test case
- [x] (@llm) `CaseTile` colors reflect pass/fail (`data-case-state`)
- [x] (@llm) `RunDetail` shows per-evaluator scores (fixture drawer)
- [x] (@llm) `EvaluatorHeatmap` renders a cell per evaluator×case
- [x] (@llm) `ModelLeaderboard` ranks endpoints with two `modelEndpointIds`
- [x] (@llm) `RunConfirmModal` confirm starts a run from the suites page

## 8. Dashboard statistics (no LLM; seed data via API) — `dashboard.spec.ts`
- [x] Stat tiles reflect seeded counts (traces / agents)  *(no "runs" tile exists on the dashboard)*
- [x] `HeroTokenCard` shows non-zero total tokens after seeding traces with usage
- [x] `PassRateGauge` renders; numeric rate asserted behind an (@llm) completed run
- [x] `TokenByAgentSection` lists per-agent token usage (legend entries)
- [x] `LatencySection` renders latency stats from seeded traces
- [x] `LiveTraceStream` shows a newly-seeded trace (seed doesn't emit SSE → asserted after reload)

## 9. Proposals (seeded = no LLM; generation = @llm) — `proposals.spec.ts`
- [x] Seeded proposal renders as a `ProposalCard` with its status
- [x] Open `ProposalDetail` → header, evidence, predicted-impact render
- [x] `PromptDiff` shows old vs new system prompt
- [x] `ModelSwitchSection` from→to — seed endpoint now supports ModelSwitch proposals (`proposals-kinds.spec.ts`)
- [x] `ToolUpdateSection` tool diff — seed endpoint now supports ToolUpdate proposals (`proposals-kinds.spec.ts`)
- [x] Approve via `ProposalActionBar` → status flips to Accepted
- [x] Reject via `ProposalActionBar` → status flips to Rejected, terminal note shown
- [x] (@llm) Generate a real proposal via the run-group optimize endpoint

## 10. Playground (@llm) — `playground.spec.ts`
- [x] (@llm) Pick agent + endpoint, send a prompt → assistant reply in `ConversationView`
- [x] (@llm) `CompletionStats` shows token usage + latency
- [x] (@llm) `AddMessageBar` adds a follow-up turn
- [x] `ParameterSlider` temperature change reflected in the request override value
- [x] (@llm) `EditableMessageBubble` edits a prior user message before re-sending

## 11. Evaluator Playground / Test Bench — `evaluator-playground.spec.ts`
- [x] (@llm) Pick a test result + an Agentic evaluator → verdict/score in `TestBenchPanes`
- [x] Run a rule-based ExactMatch evaluator on a sample → deterministic pass/fail (no LLM)

## 12. Settings (no LLM) — `settings.spec.ts`
- [x] `ProjectsTab` lists existing projects with member-count cells
- [x] Create a project via `NewProjectModal` → appears in `ProjectsTab`
- [x] Add a member via `AddMemberModal` → member row appears
- [x] `SearchIndexingTab`: trigger reindex → status reflects indexing
- [x] Project delete (ProjectsTab) requires type-to-confirm → removed + redirect
- [x] `ToggleRow` feature flags persist across reload

## 13. Admin / Invites (no LLM; admin role) — `admin.spec.ts`
- [x] Admin issues an invite → appears in the list with pending status
- [x] Admin revokes an invite → removed from list
- [x] Non-admin hitting `/admin/invites` is redirected (browser) and gets 403 (API)

## 14. Auth & access control (no LLM; separate non-storageState project) — `auth-flows.spec.ts`
- [x] Valid login (`/login`) lands on `/dashboard`
- [x] Invalid password shows an error and stays on login; raw login returns 401
- [x] Logged-out user hitting a protected route renders the login form (no client redirect to `/login`)
- [x] Logout returns to `/login` and clears the session token
- [x] Signup (`/signup?token=`) via an invite creates a user and logs in
- [x] Optimization-proposals 402 on Free tier — covered in `licensing.spec.ts` (kept)

## 15. Negative / error paths (no LLM) — `error-handling.spec.ts`
- [x] Missing-entity API route returns the standard error envelope (404)
- [x] Invalid create payload returns 400; UI guards a blank submission without crashing
- [x] A failed list query renders the per-page `ErrorBoundary`, not a blank page

---

## `ProxytraceApiClient` methods added
`createAgent` (seed), `getAgent`, `deleteAgent`, `getAgentVersions`, `updateAgentEndpoint`,
`seedAgentCall`, `getTestSuite`, `createSuiteFromTraces`, `createTestCase`,
`updateSuiteEvaluators`, `deleteSuite`, `listProviders`, `getProvidersOverview`,
`addModelToProvider`, `revokeApiKey`, `deleteProvider`, `firstEndpointId`, `firstProjectId`,
`createEvaluatorOfKind`, `getEvaluator`, `updateEvaluator`, `deleteEvaluator`,
`runEvaluatorTestBench`, `getStatistics`, `search`, `reindexSearch`, `getSearchStatus`,
`createProject`, `deleteProject`, `addProjectMember`, `listUsers`, `inviteUser`, `listInvites`,
`revokeInvite`, `getConfig`.

## Backend test-only seed endpoints
`POST /api/agents/seed` and `POST /api/agent-calls/seed` (mirror `POST /api/proposals/seed`) let
no-LLM specs create agents and captured traces without a real upstream call. The agent-call seed
accepts a `conversationId` and publishes `TraceCreatedEvent` to the SSE broadcaster (for the
grouping + live-stream specs). `proposals/seed` accepts SystemPrompt, ModelSwitch
(`ModelSwitchSeed` details), and ToolUpdate (`ToolUpdateSeed` details) kinds.

## 16. Additional coverage (beyond the original list)
- [x] **SSE** — a seeded trace streams into the dashboard `LiveTraceStream` without a reload (`sse.spec.ts`)
- [x] **Cancel** — start a run group → cancel → terminal state; UI cancel affordance (`cancel.spec.ts`)
- [x] **Cost** — per-token pricing → non-zero `costEur` in the trace metadata tab (`cost.spec.ts`)
- [x] **Delete cascade** — provider-with-endpoints/keys delete; agent-with-traces delete behavior (`delete-cascade.spec.ts`)
- [x] **Pagination / filter** — agents, suites, run groups page+filter via the paged APIs (`pagination.spec.ts`)
- [x] **Tenancy** — per-project data isolation + project switcher doesn't leak (`tenancy.spec.ts`)
- [x] **Search depth** — hit relevance, recent feed, settings persistence (`search.spec.ts`)
- [x] **Negative** — 409 duplicate model, 400 invalid evaluator/blank project, 404 unknown id (`negative.spec.ts`)

## Known gaps (product surface, not test debt)
- **Agent edit / versions / rollback / tool-add** (§3): no UI affordance or public API — these
  mutations only happen through the proxy-ingestion pipeline.
- **Suite rename** (§4): `PUT /api/test-suites/{id}` ignores `name`; no rename endpoint.
- **ToolUsage evaluator** (§6): not one of the four creatable evaluator kinds.
- **Dashboard cost widget** (§16 cost): no cost tile on the dashboard; cost is asserted on the
  Traces detail metadata tab instead.
