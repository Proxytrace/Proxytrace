# The Optimization Loop

Proxytrace's core feedback loop turns curated traces into validated, evidence-backed agent
improvements:

```
TestSuite (+ TestCases)
      │  ITestRunnerService.RunInBackgroundAsync
      ▼
TestRunGroup ── one TestRun per endpoint ── each TestCase → TestResult (scored by evaluators)
      │  on completion: IOptimizerService.EnqueueAsync(group)
      ▼
Optimizers discover OptimizationTheory hypotheses   (also: external producers via POST /api/theories)
      │  ITheoryValidationService.SubmitAsync  (dedup + per-project quota)
      ▼
A/B validation ── baseline run vs candidate run, back to back, same suite ── two-proportion test
      │  win (improvement beyond noise)            │  loss / inconclusive
      ▼                                            ▼
Draft OptimizationProposal (carries A/B evidence)   Theory marked Invalidated (metrics kept, dedup)
      │  human review on the Proposals board
      ▼
 Accepted (promoted → handoff package for the developer)  /  Rejected
      │  ProposalAdoptionService watches ingested traffic for the exact change
      ▼
 Adopted (change observed live in the agent, or confirmed manually)
```

Proxytrace is an observing proxy — it cannot change the client's actual system prompt, tools,
or model. Promoting a proposal therefore does **not** apply anything; it hands the change to
the developer (copy buttons, a markdown handoff doc, and `GET /api/proposals/{id}/artifact`)
and arms adoption tracking (Stage 5).

The user-facing description of this loop lives in `manual/guide/optimization-theories.md`,
`manual/guide/running-tests.md`, and `manual/guide/optimization-proposals.md` — keep those in
sync when the loop changes.

## Stage 1 — Run a suite

A **`TestSuite`** holds curated **`TestCase`** inputs and an N:M set of **`IEvaluator`**s.
`ITestRunnerService` executes it:

- `RunInBackgroundAsync(suite, endpoints)` — creates a **`TestRunGroup`** with one **`TestRun`**
  per endpoint (model comparison), queues them, returns immediately.
- `RunInForegroundAsync(...)` — synchronous single run; used internally (A/B validation) and in
  tests. Takes `customAgent` and an `isSystemTestRun` flag that **hides internal A/B runs** from
  the user's run list.
- Each `TestCase` produces a **`TestResult`** scored by the suite's evaluators. Live progress
  streams over SSE via `ITestResultBroadcaster`.

| Concern | File |
|---|---|
| Run orchestration | `Proxytrace.Application/TestRun/Internal/TestRunnerService.cs` (`ITestRunnerService`) |
| Run config (concurrency etc.) | `Proxytrace.Application/TestRun/TestRunnerConfiguration.cs` |
| Live results SSE | `Proxytrace.Application/Streaming/Internal/TestResultBroadcaster.cs` |
| Aggregate stats | `Proxytrace.Application/Statistics/TestRun/Internal/TestRunStatsProjector.cs` |
| API entry | `Proxytrace.Api/Controllers/TestRunGroupsController.cs` |
| Domain entities | `Proxytrace.Domain/{TestSuite,TestCase,TestRunGroup,TestRun,TestResult}/` |

When a group completes, `TestRunnerService` calls `IOptimizerService.EnqueueAsync(group)`
(`TestRunnerService.cs:178`). `TestRunGroupsController` can also enqueue on demand.

## Stage 2 — Discover theories

`IOptimizerService` (a hosted background service) hands the completed group to `IOptimizer`.
`CompositeOptimizer` fans out to every `IOptimizerImplementation`, each producing unproven
**`IOptimizationTheory`** hypotheses (Kind = system-prompt / tool-update / model-switch):

| Optimizer | File |
|---|---|
| Composite fan-out | `Optimization/Internal/CompositeOptimizer.cs` |
| Prompt rewrite | `Optimization/Internal/UpdateSystemPromptOptimizer.cs` |
| Tool definition change | `Optimization/Internal/UpdateToolDefinitionOptimizer.cs` |
| Model switch | `Optimization/Internal/SwitchModelOptimizer.cs` |
| Queue + dispatch | `Optimization/Internal/OptimizerService.cs` (`IOptimizerService`) |

A theory is **just a hypothesis** at this point — not persisted, not validated. The optimizer
submits each via `ITheoryValidationService.SubmitAsync`. External producers (users, Tracey AI,
API callers) submit the same way through `Proxytrace.Api/Controllers/TheoriesController.cs`
(`POST /api/theories`), so every theory flows through one pipeline.

## Stage 3 — Validate via A/B run

`TheoryValidationService` (hosted background service) deduplicates, enforces the per-project
concurrent-validation quota (`TheorySubmissionOutcome`: `Accepted` / `Duplicate` /
`QuotaExceeded`), then routes the theory to the matching `ITheoryValidator`. The queue itself
is in-memory; on startup the service re-queues every theory still `Proposed`/`Validating`
(`IOptimizationTheoryRepository.GetActiveAsync`) so a restart cannot strand the backlog:

| Validator | File |
|---|---|
| Pipeline + queue + quota | `Optimization/Internal/TheoryValidationService.cs` (`ITheoryValidationService`) |
| Shared A/B flow (ephemeral candidate agent) | `Optimization/Internal/Validation/AbTestTheoryValidator.cs` |
| Validator base | `Optimization/Internal/Validation/TheoryValidatorBase.cs` |
| System-prompt theory | `.../Validation/SystemPromptTheoryValidator.cs` |
| Tool-update theory | `.../Validation/ToolUpdateTheoryValidator.cs` |
| Model-switch theory | `.../Validation/ModelSwitchTheoryValidator.cs` |
| Two-proportion stats / p-value | `.../Validation/ProportionStats.cs` |
| Evidence assembly | `Optimization/Internal/Evidence/OptimizerEvidenceBuilder.cs` |

Validation runs the **baseline and candidate fresh, back to back**, against the same suite and
the agent's current state — so the only difference is the proposed change (reusing an older run
would conflate the change with agent drift while the theory waited in the queue). For prompt/tool
kinds the candidate is an **ephemeral agent** built by the validator; for model switches it is the
agent on the alternate endpoint. The candidate run is linked to the theory while still in flight
via the `CandidateRunObserver` callback, and is flagged `isSystemTestRun` so it stays out of the
user's run list.

The outcome (`TheoryValidationOutcome`) records baseline pass rate, projected pass rate, p-value,
and candidate run id **regardless of result**:
- **Won** — improvement is real (beyond sampling noise: the two-proportion p-value must be
  ≤ `AbTestTheoryValidator.SignificanceLevel` = 0.05) → spawns a **Draft `OptimizationProposal`**
  carrying the A/B comparison as evidence. Model-switch theories instead require *no* pass-rate
  regression plus a genuine cost or latency win — equal-quality-but-pricier is not a win.
- **Rejected / Inconclusive** — theory marked Invalidated; metrics still kept so the same idea
  isn't retried (dedup).

## Stage 4 — Proposal review

An **`OptimizationProposal`** has `Kind`, `Status` (`Draft`/`Accepted`/`Adopted`/`Rejected`),
`Priority`, `Rationale`, typed payloads (`SystemPromptProposal`, `ToolUpdateProposal`,
`ModelSwitchProposal`), and `EvidenceTestRunIds`. Status changes are **domain transitions**
(`Accept()`, `Reject()` from Draft; `MarkAdopted()` from Accepted) — the API's
`PATCH /api/proposals/{id}/status` returns 409 for anything else. Theories and proposals stream
to the **Proposals** board over SSE via `IProposalBroadcaster` (`proposal-created`,
`proposal-status-changed`) and `ITheoryBroadcaster`.

**Promote = handoff, not auto-apply.** On promote the UI offers the handoff package: copy
buttons for the proposed prompt / tools JSON / model name, a client-generated markdown
"apply this change" doc, and the machine-readable artifact endpoint
`GET /api/proposals/{id}/artifact` (license-gated like the rest of the controller).

`ITheoryValidationService` also supports **resetting** a terminal theory for re-validation
(`TheoryResetOutcome`) — refused if the spawned proposal was already Accepted or Adopted
(`BlockedByAcceptedProposal`).

| Concern | File |
|---|---|
| Proposal SSE | `Streaming/Internal/ProposalBroadcaster.cs` |
| Theory board SSE | `Streaming/Internal/TheoryBroadcaster.cs` |
| Proposal / theory entities | `Proxytrace.Domain/{OptimizationProposal,OptimizationTheory}/` |
| Artifact endpoint + status transitions | `Proxytrace.Api/Controllers/ProposalsController.cs` |
| DI wiring (optimizers, validators, hosted services) | `Proxytrace.Application/Optimization/Module.cs` |

## Stage 5 — Adoption tracking

After promotion, **`ProposalAdoptionService`** (hosted service,
`Optimization/Internal/Adoption/`) watches `IEntityEventService` and flips an Accepted proposal
to **Adopted** when the change shows up — exactly — in the agent's live state:

- **new `IAgentVersion`** (ingestion detected a prompt/tool change) → exact prompt string /
  tool-set match against the proposed change; the proposal records the version
  (`AdoptedAgentVersionId`/`Number`, "Adopted in v{N}").
- **`IAgent` updated** (ingestion flipped the endpoint) → endpoint match for ModelSwitch
  proposals.
- **proposal promoted** → immediate check against the agent's current state (covers "already
  applied before promoting").
- **startup sweep** over all Accepted proposals heals events missed while down.

Matching is deliberately exact (`ProposalAdoptionMatcher`); a tweaked adoption is confirmed by
the human **Mark adopted** action (`PATCH … status: Adopted`, sets `AdoptedManually`). Known
auto-detection gaps — reverting to an already-stored old version (no new-version event) and
traffic attributed to a different agent — are covered by Mark adopted; the handoff doc
recommends pinning attribution with the `X-Proxytrace-Agent` header.

## Licensing

`OptimizationProposals` and `AgenticEvaluators` are **license-gated features** — gate access
through `ILicenseService` (see [`licensing.md`](licensing.md)), not by checking tiers inline.
