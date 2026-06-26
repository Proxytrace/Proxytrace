# Implementation Plan — Expand Audit Log Scope

> **Status: IMPLEMENTED** (branch `fix/various_bugfixes`). Deviations from the plan below:
> - In-flight MFA work already claimed enum values `41–43` (`MfaEnabled`/`MfaDisabled`/
>   `MfaChallengeFailed`), so the new actions were appended at **`44–63`** instead of `41–61`.
> - **`TestCaseUpdated` was deferred**, not implemented — a test case's owning project can't be
>   resolved cheaply (suite→test-case is a serialized JSON `Guid[]`, no reverse FK; the request
>   carries no `suiteId`). Tracked as **#242**; the enum value was left out to avoid a dead action.
> - `AccessDenied` fires on **403 only** (not 401 — overlaps `LoginFailed` / unauthenticated noise).
> - A pre-existing flaky test surfaced during verification → **#243**.

## Context

The audit log (`docs/audit-log.md`) records *who did what, to which target, in which project* for
compliance and operational review. Today it covers **41 actions across ~38 endpoints** — core CRUD,
auth lifecycle, proposal status changes. A full sweep of every mutating seam found large gaps:

- **Optimization loop is almost entirely unaudited** — theory submit/reset/reject, A/B validation
  results, proposal generation, automatic adoption.
- **Test-run lifecycle & schedules** — cancel, optimize, delete, schedule CRUD, run-now: none audited.
- **Data deletion** — trace (agent-call) deletion, run/run-group deletion: no record.
- **Destructive setup purge** (`CleanupNonModelData`) is silent.
- **OIDC sign-in / JIT provisioning** is a documented gap (`docs/audit-log.md:49-50`).
- **Only failed login** records a failure outcome — authorization denials are invisible.

This plan closes the high- and medium-value gaps by appending `AuditAction` values and emitting
`LogAudit` at each seam (following the established pattern), plus two cross-cutting model additions:
OIDC JIT provisioning auditing and a failure-capture seam for denied mutations. Background/automatic
events are recorded as the **System actor** (precedent: the scheduler already emits `TestRunStarted`
as System).

## Established pattern (reuse — do not reinvent)

- Emit `audit.LogAudit(AuditAction.X, nameof(IEntity), id, label, projectId: pid, details: json)`
  **after** the mutation persists. Extension lives in
  `Proxytrace.Application/AuditLog/AuditLogExtensions.cs`; inject the marker logger `ILogger<Audit>`.
- Actor is auto-enriched by `IAuditActorAccessor` — call sites supply only action + target + project.
- Resolve `projectId` with the cheap FK projections already used elsewhere
  (`IAgentRepository.GetProjectIdAsync`, `IEvaluatorRepository.GetProjectIdAsync`) or the loaded
  aggregate's `.Agent.Project.Id` / `.Project.Id`.
- Application-layer services may emit (precedent: `TestRunSchedulerService` injects `ILogger<Audit>`).
- New enum values **append only, never renumber** (`Proxytrace.Domain/AuditLog/AuditAction.cs`,
  current max = `PasswordResetLinkIssued = 40`). The int value is persisted and reused as the `EventId`.
- Follow the "Adding a new audited action" checklist in `docs/audit-log.md` for each action.
- Emit **only on success / real transitions** — skip the no-op, failure, and 404 arms (mirrors
  archive-delete-only-when-transitioned behavior already in the code).

## New `AuditAction` values (append after `= 40`)

| Value | # | Emit seam | Actor | projectId source |
|-------|---|-----------|-------|------------------|
| `TheorySubmitted` | 41 | `TheoriesController.Submit` + `Mcp/Tools/TheoryTools.submit_theory` | User/Key | `agent.Project.Id` |
| `TheoryReset` | 42 | `TheoriesController.Reset` | User | `existing.Agent.Project.Id` |
| `TheoryRejected` | 43 | `TheoriesController.Reject` | User | `existing.Agent.Project.Id` |
| `TheoryValidated` | 44 | `Optimization/Internal/TheoryValidationService` | System | theory aggregate |
| `TheoryInvalidated` | 45 | `TheoryValidationService` | System | theory aggregate |
| `ProposalGenerated` | 46 | `TheoryValidationService` (proposal spawned) | System | theory aggregate |
| `ProposalAutoAdopted` | 47 | `Optimization/Internal/Adoption/ProposalAdoptionService` | System | proposal aggregate |
| `TestRunGroupOptimizeRequested` | 48 | `TestRunGroupsController.Optimize` | User | group's project |
| `TestRunGroupCancelled` | 49 | `TestRunGroupsController.Cancel` | User | group's project |
| `TestRunGroupDeleted` | 50 | `TestRunGroupsController.Delete` | User | group's project |
| `TestRunDeleted` | 51 | `TestRunsController.Delete` | User | run's project |
| `TestRunScheduleCreated` | 52 | `TestRunSchedulesController.Create` | User | schedule's project |
| `TestRunScheduleUpdated` | 53 | `TestRunSchedulesController.Update` | User | schedule's project |
| `TestRunScheduleDeleted` | 54 | `TestRunSchedulesController.Delete` | User | schedule's project |
| `TestRunScheduleRunNow` | 55 | `TestRunSchedulesController.RunNow` | User | schedule's project |
| `AgentCallDeleted` | 56 | `AgentCallsController.Delete` | User | call's agent project |
| `AgentVersionMoved` | 57 | `AgentVersionsController.Move` | User | agent project (old→new in details) |
| `TestCaseUpdated` | 58 | `TestCasesController.Update` | User | case's project |
| `SetupCleanupPurged` | 59 | `SetupController.CleanupNonModelData` | User | null (global) |
| `SecretsBackfilled` | 60 | `Storage/Internal/SecretsBackfillService` | System | null (global); details = per-type counts |
| `AccessDenied` | 61 | cross-cutting failure filter | varies | route project if resolvable, else null |

**OIDC JIT reuses existing actions** — no new enum: `UserSignedUp` for a normal JIT user,
`AdminBootstrapped` for the first-user-becomes-admin case.

---

## Phase 1 — Enum + frontend maps (compile-time scaffold)

1. Append values 41–61 to `Proxytrace.Domain/AuditLog/AuditAction.cs` with grouping comments.
2. `frontend/src/features/audit-log/auditLogMeta.ts` — add an entry to **both**
   `Record<AuditAction,…>` maps for every new action:
   - `AUDIT_ACTION_LABEL` — Lingui `msg\`…\`` label.
   - `ACTION_COLOR` — semantic color (deletes/`AccessDenied` → `var(--danger)`, creates →
     `var(--success)`, updates → `var(--warn)`, lifecycle → `var(--accent-primary)`/`var(--teal)`).
   TypeScript fails to compile if any action is missing — this is the exhaustiveness guard.
3. The Action filter dropdown in `AuditLog.tsx` is data-driven from these maps — no extra wiring.

**Checkpoint:** `dotnet build` + `npm run build` green (proves enum and both maps are exhaustive).

## Phase 2 — Optimization loop emission (largest gap)

1. **REST** — inject `ILogger<Audit>` into `TheoriesController`; emit `TheorySubmitted` /
   `TheoryReset` / `TheoryRejected` **only on the success arm** of each result switch. Project =
   `agent.Project.Id` / `existing.Agent.Project.Id` (already loaded).
2. **MCP** — emit `TheorySubmitted` in `Mcp/Tools/TheoryTools.submit_theory` on success (parallels
   the already-audited `ProposalTools.set_proposal_status`).
3. **Background** — inject `ILogger<Audit>` into `TheoryValidationService` and
   `ProposalAdoptionService`; emit `TheoryValidated` / `TheoryInvalidated` / `ProposalGenerated` and
   `ProposalAutoAdopted` at the persisted transitions (System actor). Put from→to / baseline &
   projected pass-rate / p-value in `details`.

## Phase 3 — Test-run lifecycle, schedules, deletions, edits

1. Inject `ILogger<Audit>` into `TestRunGroupsController`, `TestRunsController`,
   `TestRunSchedulesController`; emit the 48–55 actions after each mutation persists.
2. `AgentCallsController.Delete` → `AgentCallDeleted`; `AgentVersionsController.Move` →
   `AgentVersionMoved` (details: old/new agent ids); `TestCasesController.Update` → `TestCaseUpdated`.

## Phase 4 — Destructive admin + secrets

1. `SetupController.CleanupNonModelData` → `SetupCleanupPurged` (global). Confirm
   `SetupController.Complete` is covered transitively (routes through audited project/provider create
   paths); add a dedicated action only if it bypasses them.
2. `SecretsBackfillService` → `SecretsBackfilled` once, after the backfill transaction commits, with
   per-type counts in `details` (System actor). Skip when nothing was backfilled (no-op → no row).

## Phase 5 — Cross-cutting model additions

1. **OIDC JIT provisioning** — inject `ILogger<Audit>` into
   `Application/Auth/Internal/JitUserProvisioner.cs`; emit on the **new-user branch only** (after
   `user.AddAsync`): `AdminBootstrapped` when `total == 0`, else `UserSignedUp`. Target = new user;
   global scope. Existing-user sign-ins stay unaudited (matches local-mode; IdP owns session logs).
2. **Failure / denial capture** — add a global `IAsyncResultFilter` (or terminal middleware) that,
   for mutating verbs (POST/PUT/PATCH/DELETE) whose response is **401/403**, emits `AccessDenied`
   with `outcome: AuditOutcome.Failure` (target = route, details = path + status). Catches
   `[Authorize]`, admin-policy, and `RequiresFeature` license-gated denials uniformly.
   - **Known limitation:** access checks that return **404 to hide existence**
     (`IProjectAccessGuard` → `NotFound`) are indistinguishable from genuine 404s and are
     intentionally **not** captured — document this so it isn't mistaken for full denial coverage.

## Phase 6 — i18n, docs, manual, changelog

1. `npm run i18n:extract` → `npm run i18n:translate`; commit updated `frontend/src/locales/**`.
2. `docs/audit-log.md` — extend the inventory; **remove the OIDC "known gap" paragraph** (now
   closed); add `AccessDenied` alongside `LoginFailed` as a `Failure`-outcome producer; document the
   404-existence-hiding limitation of denial capture.
3. `manual/admin/audit-log.md` — list the new auditable actions for operators; verify with
   `cd manual && npm run docs:build`.
4. `CHANGELOG.md` `[Unreleased]` — one entry: expanded audit-log coverage.

## Out of scope (skipped to avoid log noise)

Notification read/dismiss, user self-service prefs (language, email-notification toggle), playground
completions, provider model reload, search reindex/settings, test-email send, background
data-cleanup pruning (calls/errors/audit), and all `[TestOnlyEndpoint]` seed routes.

## Verification

1. **Backend tests** — invoke the `test` skill first (mandatory; it owns the harness). Per new
   action, assert an `IAuditLogEntry` with the right `Action`/`TargetType`/`ProjectId`/`Outcome` is
   written after the mutation, and assert **no row** on failure/no-op arms. Cover at least:
   - System actor — theory validation (`TheoryValidated` + `ProposalGenerated`).
   - User actor — `TheorySubmitted`.
   - OIDC branch — `JitUserProvisioner`: first user → `AdminBootstrapped`, second → `UserSignedUp`.
   - Denial — non-admin POST to an admin route → `AccessDenied` / `Failure`.
2. **Build** — `dotnet build` + `npm run build` + `cd manual && npm run docs:build`.
3. **Manual smoke** — boot the stack, run a theory submit and a denied mutation, then
   `GET /api/audit-log?action=TheorySubmitted` and `?action=AccessDenied`; confirm rows and correct
   scope (admins see global rows; project members never do).

## Files touched (representative)

- `Proxytrace.Domain/AuditLog/AuditAction.cs`
- `Proxytrace.Api/Controllers/{Theories,TestRunGroups,TestRuns,TestRunSchedules,AgentCalls,AgentVersions,TestCases,Setup}Controller.cs`
- `Proxytrace.Api/Mcp/Tools/TheoryTools.cs`
- `Proxytrace.Application/Optimization/Internal/TheoryValidationService.cs`,
  `.../Adoption/ProposalAdoptionService.cs`
- `Proxytrace.Application/Auth/Internal/JitUserProvisioner.cs`
- `Proxytrace.Storage/Internal/SecretsBackfillService.cs`
- new: `Proxytrace.Api/Auth/AuditDeniedAccessFilter.cs` (or middleware) + DI registration
- `frontend/src/features/audit-log/auditLogMeta.ts`
- `docs/audit-log.md`, `manual/admin/audit-log.md`, `CHANGELOG.md`, `frontend/src/locales/**`
