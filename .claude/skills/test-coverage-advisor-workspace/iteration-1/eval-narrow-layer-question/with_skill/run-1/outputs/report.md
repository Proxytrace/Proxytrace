## Proxytrace.Application coverage — short answer

**51.7% line coverage, 3.8% branch coverage across 65 files.** That puts it at the bottom of the stack alongside `Proxytrace.Api` — every other meaningful layer (`Proxytrace.Domain` 74%, `Proxytrace.Common` 90%, `Proxytrace.Storage` 61%) is better tested than the orchestration layer that ties them together. Branch coverage in particular is a rounding error.

## Where Proxytrace.Application sits relative to other layers

| Layer | Files | Line cov | Branch cov |
|---|---:|---:|---:|
| Proxytrace.Common | 12 | 89.9% | 18.2% |
| Proxytrace.Domain | 104 | 74.1% | 9.5% |
| Proxytrace.Storage | 57 | 61.3% | 16.7% |
| **Proxytrace.Application** | **65** | **51.7%** | **3.8%** |
| Proxytrace.Api | 49 | 52.2% | 13.0% |
| Proxytrace.Infrastructure | 4 | 0.0% | 0.0% |

## Entirely untouched files in Proxytrace.Application (0% line coverage)

These have **no test ever exercising a line**, and most of them ship public surface that real code calls:

| File | Pub API uncov | Cx | Churn (90d) |
|---|---:|---:|---:|
| `Proxytrace.Application/Statistics/Internal/StatisticsService.cs` | 16/16 | 10 | 5 |
| `Proxytrace.Application/Playground/Internal/PlaygroundService.cs` | 3/3 | 64 | 2 |
| `Proxytrace.Application/Agent/AgentNameGenerator.cs` | 2/2 | 2 | 7 |
| `Proxytrace.Application/Statistics/Internal/Worker/StatisticsBackfillHostedService.cs` | 3/3 | 16 | 2 |
| `Proxytrace.Application/Statistics/Internal/Worker/StatisticsHostedService.cs` | 1/1 | 14 | 2 |
| `Proxytrace.Application/Statistics/Internal/AbstractStatsProjector.cs` | 1/1 | 2 | 2 |
| `Proxytrace.Application/Statistics/TestRun/Internal/TestRunStatsProjector.cs` | 1/1 | 9 | 2 |
| `Proxytrace.Application/Search/Internal/TraceIndexPrunerService.cs` | 1/1 | 3 | 2 |
| `Proxytrace.Application/Search/Internal/QuerySanitizer.cs` | 1/1 | 6 | 1 |
| `Proxytrace.Application/Streaming/IProposalBroadcaster.cs` | 1/1 | 1 | 1 |
| `Proxytrace.Application/Statistics/StatisticsBucket.cs` | 1/1 | 0 | 1 |

And a near-zero cluster — technically a hit or two, but effectively untested:

- `Proxytrace.Application/Search/Internal/LuceneSearchService.cs` — 7.3% line, complexity 21
- `Proxytrace.Application/Search/Internal/ReindexStateTracker.cs` — 5.9% line
- `Proxytrace.Application/Streaming/Internal/ProposalBroadcaster.cs` — 2.8% line, 3/3 public methods uncovered
- `Proxytrace.Application/Optimization/Internal/SwitchModelOptimizer.cs` — 10.9% line, complexity 18
- `Proxytrace.Application/Statistics/StatisticsRecords.cs` — 13.4% line
- `Proxytrace.Application/Search/Internal/Mappers/TestCaseDocumentMapper.cs` — 13.6% line
- `Proxytrace.Application/Search/Internal/LuceneSearchIndexStatistics.cs` — 13.8% line

## Lightly-tested but high-churn (regression risk in Proxytrace.Application)

These have some coverage, but they're moving fast and the branches are mostly unexercised:

- `Proxytrace.Application/TestRun/Internal/TestRunnerService.cs` — 69.6% line / **2.1% branch**, **22 commits** in 90d, 3/4 public methods uncovered. This is the central test-execution orchestrator and it's churning hard.
- `Proxytrace.Application/Ingestion/Internal/AgentCallIngestor.cs` — 65.8% line / 5.3% branch, 10 commits, 1/2 public methods uncovered. The parse-and-persist pipeline.
- `Proxytrace.Application/Ingestion/Internal/OpenAiCallParser.cs` — 61.2% line / 3.8% branch, complexity **151**. Very high complexity, very low branch coverage — exactly the shape that hides parsing bugs.
- `Proxytrace.Application/Setup/Internal/SetupService.cs` — 49.4% line, 3/6 public methods uncovered.

## Top 3 to tackle first

1. **`StatisticsService.cs`** — 16-of-16 public methods uncovered, used by `StatisticsController` (which itself is only 34.7% covered and was touched 11 times in 90 days). This is the entire statistics read-path with zero safety net; any change to a query shape will break silently. Highest score in the whole repo for Proxytrace.Application gaps.
2. **`TestRunnerService.cs`** — the busiest file in the layer (22 commits) and the heart of the product. 69.6% line coverage *looks* okay until you see 2.1% branch coverage. The happy path is exercised; every failure / cancellation / partial-result path is not. Treat this as a **regression-risk** target, not a coverage chore.
3. **`OpenAiCallParser.cs`** — complexity 151 with 3.8% branch coverage. Parsers of vendor-shaped JSON are the canonical place where missing branch coverage hides production crashes. Adding table-driven tests over real captured payloads is high-leverage here.

Honourable mention: `PlaygroundService.cs` has complexity 64 with **zero** coverage. Lower churn (only 2 commits in 90 days) so it's less urgent than the three above, but it's a large untested blob that should not be ignored if it's user-facing.

## Suggested next step

Want me to draft the first MSTest class for `StatisticsService` (or `TestRunnerService`, if you'd rather lead with the regression-risk angle)? Both have repository/generator infrastructure already in place via `BaseTest<Module>`, so the setup cost is small.
