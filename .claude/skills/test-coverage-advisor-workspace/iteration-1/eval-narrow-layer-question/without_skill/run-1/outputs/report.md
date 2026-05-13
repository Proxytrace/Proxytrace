# Trsr.Application Test Coverage

Computed from the freshly regenerated cobertura artifacts under `TestResults/` (covers Trsr.Application source files only; Migrations and the test project itself excluded).

## Headline

- **Overall: 1670 / 3144 lines = 53.1%** across 65 source files.
- The layer is a mixed bag: auth, optimizer code, the DI module, broadcaster interfaces, and the Search mapping pieces are well covered. **Statistics, Playground, and a handful of Search/Streaming background services are essentially untested.**

## Coverage by sub-namespace

| Sub-namespace | Covered / Total | % |
|---|---|---|
| `Agent` | 0 / 31 | 0.0% |
| `Playground` | 23 / 201 | 11.4% |
| `Statistics` | 73 / 501 | 14.6% |
| `Setup` | 44 / 109 | 40.4% |
| `Search` | 372 / 731 | 50.9% |
| `Ingestion` | 324 / 509 | 63.7% |
| `Cleanup` | 15 / 23 | 65.2% |
| `TestRun` | 126 / 181 | 69.6% |
| `Optimization` | 258 / 365 | 70.7% |
| `Streaming` | 152 / 207 | 73.4% |
| `Auth` | 177 / 180 | 98.3% |
| `Module.cs` | 98 / 98 | 100.0% |
| `Evaluator` | 8 / 8 | 100.0% |

## Totally untouched (0% coverage)

These files have executable lines but zero hits — no test exercises them, end-to-end or otherwise:

| Lines | File |
|---:|---|
| 156 | `Playground/Internal/PlaygroundService.cs` |
| 139 | `Statistics/Internal/StatisticsService.cs` |
|  71 | `Statistics/Internal/Worker/StatisticsBackfillHostedService.cs` |
|  65 | `Statistics/Internal/Worker/StatisticsHostedService.cs` |
|  35 | `Search/Internal/TraceIndexPrunerService.cs` |
|  31 | `Agent/AgentNameGenerator.cs` |
|  29 | `Statistics/TestRun/Internal/TestRunStatsProjector.cs` |
|  20 | `Setup/ISetupService.cs` *(interface + record constructors — basically noise)* |
|  19 | `Search/Internal/QuerySanitizer.cs` |
|  17 | `Statistics/Internal/AbstractStatsProjector.cs` |
|  14 | `Streaming/IProposalBroadcaster.cs` *(interface — noise)* |
|  12 | `Statistics/StatisticsBucket.cs` *(record — noise)* |
|   6 | `Playground/Internal/PlaygroundEvent.cs` *(record — noise)* |

If you discount the records/interfaces (~52 lines), there are still **~565 lines** of real, untested logic.

## Lowest-coverage real files (<50%, nonzero)

| % | Hit / Tot | File |
|---:|---|---|
|  2.8% |  1 /  36 | `Streaming/Internal/ProposalBroadcaster.cs` |
|  5.9% |  1 /  17 | `Search/Internal/ReindexStateTracker.cs` |
|  7.3% |  9 / 123 | `Search/Internal/LuceneSearchService.cs` |
| 10.9% |  7 /  64 | `Optimization/Internal/SwitchModelOptimizer.cs` |
| 13.6% |  8 /  59 | `Search/Internal/Mappers/TestCaseDocumentMapper.cs` |
| 13.8% |  4 /  29 | `Search/Internal/LuceneSearchIndexStatistics.cs` |
| 32.3% | 41 / 127 | `Statistics/StatisticsRecords.cs` |
| 38.3% | 18 /  47 | `Optimization/Internal/OptimizerService.cs` |
| 39.1% |  9 /  23 | `Optimization/Internal/CompositeOptimizer.cs` |
| 47.1% |  8 /  17 | `Search/Internal/Mappers/AbstractDocumentMapper.cs` |
| 49.4% | 44 /  89 | `Setup/Internal/SetupService.cs` |

## What looks healthy

- **`Auth` (98.3%)** — `JitUserProvisioner`, `LegacyClaimService`, `LocalTokenIssuer`, `LoginService` all at 100%.
- **`Optimization`** has 100% coverage on `UpdateSystemPromptOptimizer` and `UpdateToolDefinitionOptimizer` (driven by `UpdateSystemPromptOptimizerTests.cs` and `UpdateToolDefinitionOptimizerTests.cs`).
- **`Ingestion`** is at ~64% — `AgentCallIngestor` (65.8%) and `OpenAiCallParser` (61.2%) have real tests (`AgentCallIngestorTests.cs`) but the parser is a big file (374 lines) so there's still ~145 lines unhit.
- **`TestRunnerService`** at 69.6% (covered by `TestRunnerServiceTests.cs`).
- **DI `Module.cs`** at 100%.

## What to test next (in priority order)

1. **`Statistics` sub-namespace (14.6%, ~428 untested lines)** — `StatisticsService`, the two hosted services (`StatisticsHostedService`, `StatisticsBackfillHostedService`), `TestRunStatsProjector`, `AbstractStatsProjector`, plus 86 untested lines in `StatisticsRecords.cs`. This is by far the biggest untested area and it's user-visible (it feeds the dashboard).
2. **`Playground/Internal/PlaygroundService.cs` (156 lines, 0%)** — entire playground execution path is untested.
3. **`Search` background + service code** — `LuceneSearchService.cs` (7.3%), `TraceIndexPrunerService.cs` (0%), `QuerySanitizer.cs` (0%), `ReindexStateTracker.cs` (5.9%), the mapper files. The Lucene write path is partially exercised; the *read*/query path is essentially not.
4. **`Optimization/Internal/SwitchModelOptimizer.cs` (10.9%)** — the other two optimizers are at 100%, this one is an obvious gap and should be cheap to bring up to parity.
5. **`Streaming/Internal/ProposalBroadcaster.cs` (2.8%)** — the other two broadcaster interfaces (`ITraceBroadcaster`, `ITestResultBroadcaster`) hit 100% so there is presumably a tested pattern to copy.
6. **`Agent/AgentNameGenerator.cs` (31 lines, 0%)** — small, isolated, easy win.

## Notes / caveats

- The coverage run completed for most projects, but the Infrastructure test run aborted with file-lock errors against `Trsr.Application.dll` (parallel test execution colliding with coverlet). The numbers above still aggregate every cobertura file written this morning, so Application coverage from the other test projects (Api.Tests, Application.Tests, Domain.Tests, Storage.Tests) is included.
- "0%" on interfaces and record-only files is expected and not a real gap — they're flagged above with *(noise)*.
- Source: `/Users/eberharter/Trsr/TestResults/*/coverage.cobertura.xml` (generated 2026-05-13 07:00-07:03).
