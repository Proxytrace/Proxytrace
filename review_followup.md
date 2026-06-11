# Backend Review — Follow-up Items

Smaller or riskier findings from the 2026-06-11 backend review that were deliberately **not**
fixed in the review PR. Big/medium wins (security gating, statistical gating of theory wins,
switch-optimizer comparison baseline, theory-queue restart recovery, test-result index) were
fixed directly — see the PR / CHANGELOG.

## Security

- **JWT signing key persisted to `appsettings.local.json`**
  (`Proxytrace.Api/Auth/AppSettingsLocalSigningKeyStore.cs`). Acceptable for a self-hosted
  single-node install, but consider supporting an env-var-only mode and/or encrypting at rest
  (Data Protection API) for hardened deployments. Document that the file must stay out of
  version control and backups.
- **Full API key values returned in admin DTOs** (`ApiKeyDto.KeyValue`,
  `ModelProviderDto.UpstreamApiKey` on admin endpoints). Consider masked values plus an
  explicit admin-only "reveal" endpoint so keys don't sit in browser devtools/log captures.
  Requires coordinated frontend changes (reveal/copy UX on the providers page).
- **Setup probe endpoints can still reach internal hosts (admin-only SSRF)**
  (`SetupController.TestConnection`/`ListModels`, now Admin-gated). Admins legitimately point
  Proxytrace at LAN-hosted LLMs (Ollama etc.), so IP-range blocking would break the product;
  if multi-tenant hosting ever becomes a target, revisit with an allowlist option.
- **Theory submission quota/dedup check is not atomic with the insert**
  (`TheoryValidationService.SubmitAsync`): two concurrent submissions can both pass the
  quota/dedup checks. Worst case is a duplicate validation run — low impact, but a
  `IAsyncLock` keyed on `(agentId, contentHash)` would close it.

## Performance / efficiency

- **Optimizer queue is in-memory without recovery** (`OptimizerService.EnqueueAsync` channel):
  groups enqueued for theory discovery are lost on restart. Lower impact than the theory queue
  (fixed) because discovery can be re-triggered from `TestRunGroupsController`, but symmetric
  recovery would be consistent.
- **Statistics bucketing/percentiles computed in memory**
  (`AgentCallStatsQueries.GetTokenUsageAsync`, `GetLatencyAsync`, `GetTokenUsageByAgentAsync`):
  rows are narrowed to a few columns but unaggregated rows still cross the wire. Now that
  storage is PostgreSQL-only, `date_trunc`/`percentile_cont` could push these into SQL.
- **`TestResultRepository` evaluator filters run in memory over JSON columns**
  (`GetRecentByEvaluatorAsync`, `SearchByEvaluatorAsync` load up to 500/1000 rows then filter
  on the serialized `Evaluations` JSON). A denormalized evaluation table (or Postgres `jsonb`
  containment queries) would let the filter run in SQL. The new `CreatedAt` index makes the
  current top-N scans cheap; revisit if result volumes grow.
- **Per-row mapper lookups rely on the per-lifetime-scope entity cache**
  (`AgentCallConfig.Map`, `TestResultConfig.Map` resolve agent/version/endpoint/evaluator per
  row). Within one request the `IEntityCache` collapses this to one query per distinct entity,
  so it is not the N+1 it looks like — but a cold scope pays one round-trip per distinct id.
  A batch-aware `Map(IReadOnlyList<...>)` overload with `GetManyAsync` prefetch would remove that.
- **`ModelProvidersController.GetOverview` uses `task.Result` after `Task.WhenAll`** — safe but
  unconventional; awaiting each task reads better.

## Domain design

- **Cascade deletes configured on archivable targets** (`TestRunConfig` → `ModelEndpointEntity`
  cascade, `AgentVersionConfig` → `AgentEntity` cascade, `ModelEndpointConfig` →
  `ModelProviderEntity` cascade). Since these parents archive instead of hard-delete, the
  cascades only fire on the (still possible) provider hard-delete path. `docs/domain-entities.md`
  already records ModelProvider archiving as a known gap; doing that follow-up should also
  flip these to `Restrict` (requires a migration).
- **Redundant `if (string.IsNullOrWhiteSpace(...))` wrappers around `Validation.NotNullOrWhiteSpace`**
  in several entity `Validate` methods (Project, ModelProvider, proposals, theories). The
  wrapper is currently required because the helper returns `ValidationResult.Success` (null —
  via a `!` suppression in `Proxytrace.Common/Validation/Validation.cs`, itself a violation of
  the no-`!` rule) and an unconditional `yield return` would emit nulls. Make the helper
  null-free first, then drop the wrappers.
- **`TestResultEntity.DurationMs` actually stores microseconds** (both mapper directions use
  `TotalMicroseconds`, so the round-trip is correct). Rename to `DurationMicroseconds` for
  clarity when a schema-touching migration is next scheduled.
- **Archived agents remain referenced by test suites** (`AgentRepository` has no
  `ArchiveRelationsAsync`). Likely intentional (suites are history-bearing), but worth an
  explicit decision + doc note.

## Optimization loop (soundness, minor)

- **`ModelSwitchTheoryValidator` rejects on any raw pass-rate dip** — conservative and safe,
  but a single flaky case can veto a 50% cost saving. If that proves too strict in practice,
  consider a non-inferiority gate (reject only when the regression is statistically
  significant), mirroring the new significance gate on improvements.
- **Latency comparison sums total run latency** (`TheoryValidatorBase.Metrics`) — fine while
  baseline and candidate always run the same suite, but would silently mislead if result
  counts ever diverge (e.g. partial failures). Consider per-result mean latency.
- **Two-sided p-value used for a one-sided decision** (`AbTestTheoryValidator`): the win gate
  only fires on improvements, so a one-sided test at the same α would be slightly more
  powerful. Two-sided is the conservative choice; change only with deliberate intent.
