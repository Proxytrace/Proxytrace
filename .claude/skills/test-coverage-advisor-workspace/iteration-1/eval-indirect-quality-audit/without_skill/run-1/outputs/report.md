# Pre-Release Backend Risk Audit (Testing)

Scope: every backend project in `Proxytrace.sln` (Api, Application, Infrastructure, Storage, Domain, Serialization, Common). I cross-referenced production source against the seven `*.Tests` projects and the most recent cobertura coverage reports in `TestResults/`.

**Headline:** the Domain layer, auth subsystem, storage abstractions, and ingestion path are well covered. The serious risk sits in the **Application services that orchestrate live behavior** — proxy streaming, search indexing, statistics projection, the optimizer composition, and the playground. These are exactly the hot spots that touch users on day one of the release.

Note on coverage artifacts: `TestResults/CoverageReport/Summary.txt` is stale (Mar 27, 4 assemblies, 87% lines). It does not reflect today's solution shape. The May 12 cobertura runs are more current but the directories were transient and I had to rely on source/test cross-reference to fill in the gaps. I would not ship the release using the stale summary as evidence.

---

## Severity-1 — fix before release

### 1. `OpenAiProxyController` streaming path (`Proxytrace.Api/Controllers/OpenAiProxyController.cs`, 318 lines)
This is the money-path: every customer LLM call goes through it.

- `OpenAiProxyControllerTests.cs` has 5 tests, all of which exercise the **buffered** branch (`ProxyBufferedResponseAsync`). The **`ProxyStreamingResponseAsync`** branch (lines 167-199) is not exercised at all — and that is the branch that flushes SSE chunks to the client and accumulates the full response for ingestion.
- `InjectStreamUsageOption` (lines 267-296) — JSON rewrite to force `stream_options.include_usage=true` — has no test. A malformed or already-set `stream_options` silently changes behavior.
- `IsStreamingRequest` (lines 298-317) has no test for the content-type fallback or invalid JSON path.
- The `ForwardedRequestHeaders` / `ForwardedResponseHeaders` allow-lists are untested. If you accidentally let `authorization` flow through unmodified to upstream (replaced on line 256), you leak our internal API key handling; regression test missing.

**Add tests:** streaming happy path that asserts (a) chunks arrive in order on `Response.Body`, (b) accumulated body is fed to the ingestor, (c) usage option is injected. Add `InjectStreamUsageOption` unit tests for: (i) missing field, (ii) already present, (iii) malformed JSON returns original bytes.

### 2. `OpenAiCallParser` (`Proxytrace.Application/Ingestion/Internal/OpenAiCallParser.cs`, **547 lines**)
The largest file in the Application layer. It parses arbitrary OpenAI request/response JSON into domain objects. **Zero dedicated tests.** It is only indirectly exercised by `AgentCallIngestorTests` (the ingestor uses it via DI), and most error/edge branches don't get hit.

What is at risk if this regresses: every captured trace is corrupted or dropped. Failure mode is silent — `TryParse` returns `null` on missing fields and the ingestor skips the call without surfacing anything to the user.

**Add tests for:** missing `messages`, missing system message (early return on line 53-56), tool-call response shape, streaming-format response (delta chunks vs final choice), usage block absent, error-status responses with non-JSON body, request without `model`, request with custom model parameters. Each branch in `ParseConversation`, `ParseAgentMessage`, `ParseUsage`, `ParseTools`, `ParseModelParameters`, `ParseErrorMessage`. A table-driven test against fixture JSONs is the right shape here.

### 3. Statistics pipeline (`Proxytrace.Application/Statistics/Internal/`)
- `StatisticsService` (210 lines) — only exercised through `StatisticsControllerTests`. The aggregation math (`GetSummaryAsync`'s pass-rate computation, `ToRunFilterAsync`, summing over `TestRunStats`) has no direct unit test. Arithmetic correctness on dashboards is something users will eyeball immediately on release day.
- `StatisticsHostedService` (97 lines) and `StatisticsBackfillHostedService` (114 lines) — **no tests anywhere**. These are `BackgroundService`s that drive the entire stats projection on a schedule. If they crash silently the dashboard goes stale and nobody notices.
- `TestRunStatsProjector` — no tests.
- `TestRunStatsStore` (`Proxytrace.Storage/Internal/Statistics/TestRunStatsStore.cs`, 177 lines) — no tests, although the sibling `AgentCallStatsQueriesTests` and `EvaluatorStatsQueriesTests` exist.

**Add tests for:** `StatisticsService.GetSummaryAsync` pass-rate aggregation with zero/partial coverage, `GetPassRatesAsync` ordering and filter conversion, `TestRunStatsProjector` projection logic, `TestRunStatsStore` round-trip + idempotent upserts. For the hosted services, a minimal "tick once, asserts writer called" test catches the most common breakage (DI ctor changes that throw at runtime).

### 4. `TestRunnerService` (`Proxytrace.Application/TestRun/Internal/TestRunnerService.cs`, 290 lines)
`TestRunnerServiceTests.cs` exists (197 lines) but the production class has materially more surface than the test file:
- Unbounded channel + concurrent cancellation via `cancellationTokens` dictionary — no concurrency tests (parallel enqueues, cancel-then-re-enqueue, cancel mid-run).
- `BackgroundService.ExecuteAsync` happy path is covered; abnormal terminations (channel closed, optimizer throws, broadcaster throws) are not.

**Add:** a test that cancels a queued run before it executes, a test where the optimizer throws and asserts results are still persisted, and a test enqueueing N runs concurrently.

### 5. Search subsystem (`Proxytrace.Application/Search/Internal/`)
- `LuceneSearchService` (170 lines) — no dedicated test.
- `LuceneIndexWriter` (105 lines) — no dedicated test.
- `LuceneSearchIndexer`, `LuceneSearchIndexStatistics`, `LuceneDirectoryFactory`, `ProjectSearchSettingsResolver`, `QuerySanitizer`, `ReindexStateTracker`, `TraceIndexPrunerService` — none of these has a test file.
- `IndexingRepositoryDecorator` — no test. This decorator wraps every searchable repository and silently swallows indexing failures via a `Lazy<>` chain plus a settings check. A bug here means "documents missing from search" — exactly the kind of user-visible regression that's hard to debug after the fact.
- `SearchControllerTests` is the only thing in this area; that's a thin HTTP test, not coverage of the actual search/index logic.

**Add at minimum:** `QuerySanitizer` unit tests (security-relevant; user input goes into a Lucene query), `IndexingRepositoryDecorator` tests for the four branches in `IndexIfAllowedAsync` (disabled / auto-reindex off / kind not in set / happy path) and the orphan-removal contract in `RemoveAsync`, `LuceneIndexWriter` round-trip (write → read), `TraceIndexPrunerService` schedule/threshold logic.

---

## Severity-2 — fix this sprint if you can

### 6. Optimizer composition (`Proxytrace.Application/Optimization/Internal/`)
- `UpdateSystemPromptOptimizer` and `UpdateToolDefinitionOptimizer` are well-covered (357 + 305 LoC of tests).
- `SwitchModelOptimizer` (100 lines) — **no dedicated test**, despite non-trivial logic (best-alternative selection, stats lookup, pass-rate comparison).
- `CompositeOptimizer` (42 lines) — no test. Fan-out + aggregation. Cheap test to add and high regression value.
- `OptimizerService` (76 lines) — no test.

### 7. `PlaygroundService` (`Proxytrace.Application/Playground/Internal/PlaygroundService.cs`, 237 lines)
Only exercised via `PlaygroundControllerTests`. The SSE streaming + tool-call event emission inside the service has no unit test. If the playground is a documented release feature, this is Sev-1; otherwise Sev-2.

### 8. Hot controllers with shallow tests
- `TestSuitesController` (317 LoC) — `TestSuitesControllerTests` (78 LoC) is small relative to surface; spot-check whether N:M evaluator-binding edge cases (add/remove/replace) are covered. The `TestSuiteRepository.UpdateRelationsAsync` override is a known foot-gun pattern in this codebase per `CLAUDE.md`.
- `EvaluatorsController` (287 LoC) — covered (213 LoC) but check that every concrete evaluator subtype's create/update path round-trips through the controller (there are at least eight subtypes).
- `ModelProvidersController` (233 LoC, 205 LoC tests) — likely fine.

### 9. `AbstractRepository<T1,T2>` (`Proxytrace.Storage/Internal/AbstractRepository.cs`, 403 lines)
Used by every entity. Covered indirectly by per-entity repo tests. Specifically untested:
- `UpdateOwnedEntities` reflection-based update path (lines 347-383). Owned-entity replacement and null-to-value transitions are the kind of EF Core edge case that breaks silently with provider changes.
- `RemoveAllAsync` notification fan-out.
- Concurrency conflict detection on `UpdatedAt` mismatch is covered by `OptimisticConcurrencyTests` — good.
- Cache-on/cache-off branching (`CanUseCache` gate driven by ambient `System.Transactions.Transaction.Current`) — `CachedRepositoryTests` covers some of it; verify the "transaction active → cache skipped" branch is hit.

### 10. Infrastructure layer
`Proxytrace.Infrastructure` is small (3 files, ~465 LoC) and `ModelClientTests` + `ProviderClientTests` exist. Sanity-check before release: error/retry/timeout paths in `ProviderClient` and `ModelClient` (timeouts, 429s, malformed provider responses).

---

## Severity-3 — note but don't block release

- `DataCleanupService` (44 lines) — small, no test, low risk.
- `AgentNameGenerator` (60 lines) — no test, but it's a cosmetic feature.
- `DatabaseInitializationService` — 0% in the old summary; `DatabaseInitializationServiceTests` exists now, but worth verifying it covers the SQLite code-first path (per `CLAUDE.md` migrations aren't supported there).
- `TraceBroadcaster` / `TestResultBroadcaster` / `ProposalBroadcaster` — TraceBroadcaster and TestResultBroadcaster have tests; `ProposalBroadcaster` (in `Proxytrace.Application/Streaming/Internal/`) does **not**. Same SSE shape, cheap to add.
- `StorageConfiguration` (14.2% in old summary) and `SqlServerConfiguration` (0%) — provider auto-detection logic. `StorageConfigurationTests` exists; confirm Postgres + SQL Server connection-string detection branches are covered before deploying to a non-SQLite environment.

---

## Cross-cutting concerns

1. **Coverage artifact is stale.** Regenerate before release: `dotnet test Proxytrace.sln --collect:"XPlat Code Coverage" --settings coverage.runsettings` and rebuild the ReportGenerator HTML. The shipped numbers in `TestResults/CoverageReport/Summary.txt` predate the Api, Application, Infrastructure, Storage test projects you've been adding (visible as untracked files in `git status`). Anyone reading that summary will draw the wrong conclusions.
2. **No load/streaming integration test** for the proxy. A single end-to-end test that POSTs a streaming request through the real ASP.NET pipeline would catch a large class of regressions cheaply.
3. **Authentication is in good shape** — `JitUserProvisionerTests`, `SigningKeyProviderTests`, `AuthControllerTests`, plus all six `Auth/Local/*` services have dedicated tests. Don't touch what's working.
4. **Domain validation is in good shape** — every entity has a `*ValidationTests.cs` file (User, Agent, AgentCall, TestSuite, TestCase, TestRun, TestRunGroup, TestResult, Project, OptimizationProposal, Invite). Continue this pattern for any new entity.

---

## Recommended order of work (1-week sprint)

1. Day 1: streaming proxy tests + `OpenAiCallParser` fixture-driven tests (Sev-1 #1, #2).
2. Day 2: `IndexingRepositoryDecorator` + `QuerySanitizer` + `LuceneIndexWriter` (Sev-1 #5 core).
3. Day 3: `StatisticsService` aggregation + `TestRunStatsStore` + hosted-service smoke tests (Sev-1 #3).
4. Day 4: `SwitchModelOptimizer` + `CompositeOptimizer` + `TestRunnerService` cancellation tests (Sev-1 #4, Sev-2 #6).
5. Day 5: regenerate cobertura, audit the new summary, plug any newly-discovered gap; add `ProposalBroadcaster` test.

Files most worth opening first:
- `/Users/eberharter/Proxytrace/Proxytrace.Application/Ingestion/Internal/OpenAiCallParser.cs`
- `/Users/eberharter/Proxytrace/Proxytrace.Api/Controllers/OpenAiProxyController.cs` (streaming branch starts line 167)
- `/Users/eberharter/Proxytrace/Proxytrace.Application/Search/Internal/IndexingRepositoryDecorator.cs`
- `/Users/eberharter/Proxytrace/Proxytrace.Application/Statistics/Internal/StatisticsService.cs`
- `/Users/eberharter/Proxytrace/Proxytrace.Application/Optimization/Internal/SwitchModelOptimizer.cs`
- `/Users/eberharter/Proxytrace/Proxytrace.Application/Optimization/Internal/CompositeOptimizer.cs`
- `/Users/eberharter/Proxytrace/Proxytrace.Storage/Internal/Statistics/TestRunStatsStore.cs`
