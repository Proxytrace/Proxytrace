# Test Coverage Review — Trsr (where to spend your day)

I re-ran `scripts/coverage.sh` against the current tree so the numbers below are fresh, not stale from `TestResults/CoverageReport/Summary.txt` (which is from March and only sees 4 assemblies). All 917 tests pass.

## Overall picture

| Layer | Lines covered | Total | % |
|---|---|---|---|
| Trsr.Testing | 28 | 28 | 100.0% |
| Trsr.Common | 303 | 337 | 89.9% |
| Trsr.Storage | 1911 | 2400 | 79.6% |
| Trsr.Domain | 1631 | 2126 | 76.7% |
| Trsr.Serialization | 122 | 229 | 53.3% |
| Trsr.Application | 1670 | 3144 | 53.1% |
| Trsr.Api | 1340 | 2568 | 52.2% |
| **Trsr.Infrastructure** | **0** | **302** | **0.0%** |
| **TOTAL** | **7246** | **11471** | **63.2%** |

The headline gap is `Trsr.Infrastructure` at literally 0%. The Domain/Storage layers are healthy — entity pattern + reflection-based DI gives you free coverage there. The pain is concentrated in:

1. **Infrastructure** — LLM calling and provider discovery, zero coverage.
2. **Application services** behind the API — Playground, Statistics, Search, Optimization are mostly skipped by the controller-level happy-path tests in `Trsr.Api.Tests`.
3. **Auth event plumbing** in `Trsr.Api/Auth/` — security-sensitive, untested.

## Top hotspots by absolute uncovered lines

| File | Cov | Tot | Uncov | % |
|---|---|---|---|---|
| `Trsr.Application/Playground/Internal/PlaygroundService.cs` | 0 | 156 | 156 | 0.0% |
| `Trsr.Infrastructure/Internal/ModelClient.cs` | 0 | 154 | 154 | 0.0% |
| `Trsr.Application/Ingestion/Internal/OpenAiCallParser.cs` | 229 | 374 | 145 | 61.2% |
| `Trsr.Application/Statistics/Internal/StatisticsService.cs` | 0 | 139 | 139 | 0.0% |
| `Trsr.Storage/Internal/Statistics/TestRunStatsStore.cs` | 5 | 135 | 130 | 3.7% |
| `Trsr.Application/Search/Internal/LuceneSearchService.cs` | 9 | 123 | 114 | 7.3% |
| `Trsr.Api/Controllers/TestRunsController.cs` | 88 | 198 | 110 | 44.4% |
| `Trsr.Api/Controllers/TestSuitesController.cs` | 93 | 199 | 106 | 46.7% |
| `Trsr.Infrastructure/Internal/ProviderClient.cs` | 0 | 87 | 87 | 0.0% |
| `Trsr.Application/Statistics/StatisticsRecords.cs` | 41 | 127 | 86 | 32.3% |
| `Trsr.Api/Controllers/EvaluatorsController.cs` | 137 | 215 | 78 | 63.7% |
| `Trsr.Storage/Internal/AbstractRepository.cs` | 191 | 266 | 75 | 71.8% |
| `Trsr.Api/Controllers/TestRunGroupsController.cs` | 52 | 125 | 73 | 41.6% |
| `Trsr.Storage/Internal/DatabaseInitializationService.cs` | 10 | 74 | 64 | 13.5% |
| `Trsr.Api/Controllers/StatisticsController.cs` | 34 | 98 | 64 | 34.7% |
| `Trsr.Storage/Internal/Statistics/AgentCallStatsQueries.cs` | 221 | 282 | 61 | 78.4% |
| `Trsr.Api/Auth/JitProvisioningEvents.cs` | 0 | 60 | 60 | 0.0% |
| `Trsr.Api/Controllers/OpenAiProxyController.cs` | 136 | 195 | 59 | 69.7% |
| `Trsr.Application/Optimization/Internal/SwitchModelOptimizer.cs` | 7 | 64 | 57 | 10.9% |
| `Trsr.Api/Module.cs` | 0 | 57 | 57 | 0.0% |
| `Trsr.Application/TestRun/Internal/TestRunnerService.cs` | 126 | 181 | 55 | 69.6% |
| `Trsr.Infrastructure/Internal/ChatClientExtensions.cs` | 0 | 52 | 52 | 0.0% |
| `Trsr.Api/Auth/LocalAuthEvents.cs` | 0 | 48 | 48 | 0.0% |
| `Trsr.Serialization/Internal/ObjectToInferredTypesConverter.cs` | 0 | 47 | 47 | 0.0% |

## Important caveat — broken/missing instrumentation

`Trsr.Infrastructure.Tests/ModelClientTests.cs` and `ProviderClientTests.cs` already exist, register a fake `IChatClient`, and pass (28 tests). But every cobertura file still reports `Trsr.Infrastructure.Internal.ModelClient` as **0/90 lines covered**. That's not "no tests written" — that's "tests not actually instrumenting the production code", almost certainly a coverlet/runsettings problem in the Infrastructure.Tests csproj (e.g. missing `coverlet.collector` package or an exclude pattern eating the assembly).

**Fix this first — it's probably a 15-minute config change and might reclaim a big chunk of the missing 302 lines without writing any tests.** Check that `Trsr.Infrastructure.Tests.csproj` has a current `coverlet.collector` PackageReference and that nothing in the project's runsettings excludes `[Trsr.Infrastructure]`. Look at `Trsr.Application.Tests.csproj` (which does report coverage) for a known-good config.

## Prioritized list — one day of testing work

I'd order it roughly like this. Items are sized so the whole list adds up to ~8 hours.

### P0 — fix the instrumentation gap (≈30 min)
- Diagnose why `Trsr.Infrastructure.Tests` produces 0% coverage for `ModelClient`/`ProviderClient` despite passing tests. Compare csproj/runsettings against `Trsr.Application.Tests`. Re-run `scripts/coverage.sh` and confirm.
- Expected payoff: 50–80% jump in Infrastructure coverage with no new tests written.

### P1 — `PlaygroundService` (≈90 min, 156 uncov lines, hot user-facing path)
- File: `Trsr.Application/Playground/Internal/PlaygroundService.cs`. There are zero tests. Method is `CompleteStreamAsync` (`IAsyncEnumerable<PlaygroundEvent>`). Branches to cover: agent-not-found and endpoint-not-found both yielding `ErrorEvent`; tool resolution (`ResolveTools(agent.Tools, request.Tools)`); conversation building from request messages; happy path produces expected `PlaygroundEvent` sequence.
- Stub `IModelClient` / streaming source with `NSubstitute` (the `Trsr.Api.Tests/PlaygroundControllerTests` has only 2 thin tests and doesn't exercise this service).
- Place in `Trsr.Application.Tests/Playground/PlaygroundServiceTests.cs`.

### P2 — `OpenAiCallParser` direct tests (≈90 min, 145 uncov lines, 61% → ~90% target)
- This is the proxy's core: every captured trace flows through it. It's currently only exercised transitively via `AgentCallIngestorTests`, which leaves 145 lines (a third of the file) untested. Add a dedicated `OpenAiCallParserTests` with table-driven cases for: tool-call requests with `arguments` as raw JSON string vs object; multi-turn assistant messages with mixed text + tool calls; streaming (`stream: true`) responses with deltas; usage block variations (`prompt_tokens` vs `input_tokens` between OpenAI and Anthropic shapes); malformed JSON should produce a useful diagnostic, not a `NullReferenceException`.
- Use canned JSON fixtures — `Trsr.Application.Tests/CannedJsonAgent.cs` already shows the pattern.

### P3 — `StatisticsService` + projector + `TestRunStatsStore` (≈90 min, ~370 uncov lines combined)
- These three classes form one feature slice and are 0% / 0% / 3.7% covered. The `StatisticsController` tests stub the service away, which is why nothing below it gets exercised.
- `StatisticsServiceTests` in `Trsr.Application.Tests/Statistics/`: cover `GetSummaryAsync` with a fake `IStatsReader<TestRunStats, _>` and `IAgentCallStatsReader`. Verify summary aggregation (`runs.Sum(r => r.TestCases)`), filter translation in `ToRunFilterAsync`, and the `GetAgentLatestSuitePassRatesAsync` projection.
- `TestRunStatsStoreTests` in `Trsr.Storage.Tests/Statistics/`: use the in-memory DB pattern from `BaseTest<Module>`. Cover `UpsertAsync` happy path + `DbUpdateException` retry branch, and `QueryAsync` filter combinations.
- Skip `TestRunStatsProjector` for now (it's a hosted-service projection — covered indirectly once the store is tested).

### P4 — Auth events (≈60 min, 108 uncov lines, security-sensitive)
- Files: `Trsr.Api/Auth/JitProvisioningEvents.cs` (60 lines, 0%) and `Trsr.Api/Auth/LocalAuthEvents.cs` (48 lines, 0%).
- Build `JwtBearerEvents` via `Create()`, hand-roll a `TokenValidatedContext` with a stubbed `ClaimsPrincipal` and `IServiceProvider`, and assert: missing principal → `Fail`; missing `sub` → `Fail` with correct message; valid token → `IJitUserProvisioner.EnsureProvisionedAsync` invoked with correct `externalSubject` (issuer|sub composition); `HttpContext.Items[CurrentUserAccessor.UserIdItemKey]` set; role claim added when missing.
- `LocalAuthEvents`: same shape — invalid GUID `sub` rejected, unknown user rejected, role claim attached.
- These are security boundary tests — worth doing even though the line count isn't the largest.

### P5 — `LuceneSearchService` + `TestCaseDocumentMapper` (≈60 min, ~165 uncov lines)
- `Trsr.Application/Search/Internal/LuceneSearchService.cs` (114 uncov, 7%) and `Mappers/TestCaseDocumentMapper.cs` (51 uncov, 14%). The `SearchControllerTests` (8 tests) sit on top of a stub.
- Build a search-service test that drives a real in-memory Lucene index (the service already accepts an index abstraction in its ctor — see `LuceneSearchService.cs:16`). Index a handful of fixture documents and assert query results, scoring, project scoping, and the empty-query branch.

### P6 — Controller branches: TestRuns, TestSuites, Evaluators (≈90 min)
- Three controllers in the 40–65% range with a lot of error-handling and validation branches uncovered (e.g. `EvaluatorsController.Update` async state machine: 0/73). Existing controller tests stop at happy-path 200s.
- Add: not-found (404) cases for each endpoint, bad-request validation paths (e.g. POST with empty body / unknown evaluator kind), the streaming endpoints (`TestRunGroupsController.Stream`, `TestRunsController.Stream` — both at 0% on the `IAsyncEnumerable` state machine).
- One test method per uncovered branch is enough; don't try to refactor the controllers.

## What to skip this sprint

- **`Trsr.Api/Module.cs` (0/57)** — composition root. Tested implicitly by every Api.Tests case that boots the container; the uncovered lines are conditional registration branches for environments you won't hit in CI. Not worth dedicated tests.
- **`Trsr.Storage/Internal/DatabaseInitializationService.cs` (10/74)** — branches are per-provider (SQLite/PG/SQL Server). You'd need a real DB to exercise them honestly.
- **`Trsr.Storage/StorageDbContextFactory.cs` (0/32)** — only used by `dotnet ef` tooling at design time; not worth testing.
- **`Trsr.Application/Statistics/Internal/Worker/StatisticsHostedService.cs` and `StatisticsBackfillHostedService.cs`** — these are hosted background services. They get exercised end-to-end once `StatisticsService` and `TestRunStatsStore` (P3) are tested. Don't write hosted-service tests directly; they're flaky and low-value.
- **`Trsr.Serialization/Internal/ObjectToInferredTypesConverter.cs` (0/47)** — small, isolated, easy win if you have leftover time, but not urgent.

## If you finish early

Drop in `Trsr.Application/Optimization/Internal/SwitchModelOptimizer.cs` (57 uncov / 11%). It's a single discover-method state machine with clear branches around cost/latency thresholds — small, well-defined, no awkward dependencies. ~30 min.

## TL;DR

Spend the day in this order:

1. Fix the Infrastructure.Tests instrumentation (~30 min). Free 200+ lines of coverage.
2. `PlaygroundServiceTests` (~90 min).
3. Dedicated `OpenAiCallParserTests` (~90 min).
4. `StatisticsServiceTests` + `TestRunStatsStoreTests` (~90 min).
5. Auth event tests for `JitProvisioningEvents` and `LocalAuthEvents` (~60 min).
6. `LuceneSearchService` end-to-end with in-memory index (~60 min).
7. Controller error/validation branches (~90 min).

That hits ~830 of the ~4,200 currently uncovered lines — should push the project from 63% to roughly 70–72%, concentrated on the hot paths (proxy ingestion, LLM calling, auth, observability stats) that you actually care about staying correct.
