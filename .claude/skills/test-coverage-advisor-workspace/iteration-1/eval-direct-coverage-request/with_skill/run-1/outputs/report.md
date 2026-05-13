## Coverage summary

- Files analyzed: **337**
- Overall line coverage: ** 50.6%** (5944/11754)
- Overall branch coverage: ** 21.3%** (4620/21652)
- Churn window: last **90 days** of git history

## By layer

| Layer | Files | Line cov | Branch cov |
|---|---:|---:|---:|
| Trsr.Api | 54 |   8.3% |   5.8% |
| Trsr.Application | 70 |  46.3% |  10.1% |
| Trsr.Common | 12 |  92.2% |  29.7% |
| Trsr.Domain | 107 |  75.0% |  32.8% |
| Trsr.Infrastructure | 4 |  48.0% |  14.7% |
| Trsr.Serialization | 5 |  48.7% |   9.1% |
| Trsr.Storage | 82 |  69.5% |  28.4% |
| Trsr.Testing | 3 | 100.0% |  46.7% |

## Top 15 files to test next

Ranked by `(1 - line_cov) * (1 + churn) * (1 + complexity) * (1 + uncovered_public_api)`.

| # | File | Line | Branch | Pub API uncov | Churn | Cx | Score |
|---:|---|---:|---:|---:|---:|---:|---:|
| 1 | `Trsr.Api/Controllers/StatisticsController.cs` |   0.0% |   0.0% | 16/16 | 11 | 65 | 4.07 |
| 2 | `Trsr.Api/Controllers/TestRunsController.cs` |   0.0% |   0.0% | 6/6 | 24 | 36 | 3.27 |
| 3 | `Trsr.Api/Controllers/ModelProvidersController.cs` |   0.0% |   0.0% | 15/15 | 9 | 19 | 2.94 |
| 4 | `Trsr.Storage/Internal/Statistics/AgentCallStatsQueries.cs` |   0.0% |   0.0% | 10/10 | 4 | 71 | 2.76 |
| 5 | `Trsr.Api/Controllers/AgentCallsController.cs` |   0.0% |   0.0% | 5/5 | 15 | 36 | 2.56 |
| 6 | `Trsr.Application/Statistics/Internal/StatisticsService.cs` |   0.0% |   0.0% | 16/16 | 5 | 10 | 2.54 |
| 7 | `Trsr.Api/Controllers/EvaluatorsController.cs` |   0.0% |   0.0% | 7/7 | 7 | 41 | 2.32 |
| 8 | `Trsr.Api/Controllers/AgentsController.cs` |   0.0% |   0.0% | 6/6 | 10 | 17 | 2.12 |
| 9 | `Trsr.Api/Controllers/OpenAiProxyController.cs` |   0.0% |   0.0% | 2/2 | 13 | 34 | 2.07 |
| 10 | `Trsr.Api/Controllers/TestRunGroupsController.cs` |   0.0% |   0.0% | 8/8 | 5 | 15 | 1.97 |
| 11 | `Trsr.Api/Controllers/AuthController.cs` |   0.0% |   0.0% | 10/10 | 2 | 16 | 1.94 |
| 12 | `Trsr.Application/Playground/Internal/PlaygroundService.cs` |   0.0% |   0.0% | 3/3 | 2 | 64 | 1.82 |
| 13 | `Trsr.Api/Controllers/SearchController.cs` |   0.0% |   0.0% | 6/6 | 5 | 12 | 1.77 |
| 14 | `Trsr.Api/Controllers/TestSuitesController.cs` |  46.7% |  25.0% | 8/9 | 19 | 42 | 1.77 |
| 15 | `Trsr.Api/Module.cs` |   0.0% |   0.0% | 1/1 | 14 | 9 | 1.73 |

## Files with public API and zero coverage

- `Trsr.Api/Controllers/StatisticsController.cs` — 16 public members, complexity 65, churn 11
- `Trsr.Application/Statistics/Internal/StatisticsService.cs` — 16 public members, complexity 10, churn 5
- `Trsr.Api/Controllers/ModelProvidersController.cs` — 15 public members, complexity 19, churn 9
- `Trsr.Api/Controllers/AuthController.cs` — 10 public members, complexity 16, churn 2
- `Trsr.Storage/Internal/Statistics/AgentCallStatsQueries.cs` — 10 public members, complexity 71, churn 4
- `Trsr.Api/Controllers/TestRunGroupsController.cs` — 8 public members, complexity 15, churn 5
- `Trsr.Api/Controllers/EvaluatorsController.cs` — 7 public members, complexity 41, churn 7

## Where to spend your day

The headline finding is a layer-level imbalance, not a file-level one. `Trsr.Domain` sits at 75% line coverage and `Trsr.Common` at 92%, but `Trsr.Api` is at **8.3% line / 5.8% branch** and `Trsr.Application` at **46% line / 10% branch** — every entry point and most of the orchestration tier is effectively untested. The pure code is well-covered; the code that actually talks to users, the database, and external models is not.

Within that, three concrete priorities for a one-day budget:

1. **`Trsr.Application/Statistics/Internal/StatisticsService.cs`** (rank 6) — start here even though it isn't #1. 16 public members, zero coverage, and it's the orchestration layer that both `StatisticsController` and `AgentCallStatsQueries` sit on top of. Testing this gives you the most leverage per hour: a service-level test class with a real in-memory DB (your `BaseTest<TModule>` pattern) covers the business logic, and the controller above it becomes a thin pass-through to assert with one or two HTTP-level happy-path tests.
2. **`Trsr.Storage/Internal/Statistics/AgentCallStatsQueries.cs`** (rank 4) — complexity **71** with **zero** tests is the single densest untested blob in the repo. Dense LINQ-to-EF query code is exactly where silent bugs hide (grouping, time-window boundaries, null joins). Worth a focused 2–3 hours of query-level tests against an in-memory provider, especially since `StatisticsService` depends on it.
3. **`Trsr.Api/Controllers/TestRunsController.cs`** (rank 2) — **24 commits in the last 90 days** and 0% coverage. That's the highest-churn untested file in the solution and a clear regression risk: every change ships blind. Even a handful of `WebApplicationFactory`-style integration tests covering the main GET/POST paths would dramatically reduce risk here.

A couple of notes on what to skip: `Trsr.Api/Module.cs` (rank 15) is composition-root wiring — leave it; integration tests will exercise it implicitly. `TestSuitesController` (rank 14) already has 47% coverage and lower churn-adjusted risk than the zero-coverage controllers above it; round-trip its remaining endpoints only if you finish the top three.

If you have time after the Statistics stack + `TestRunsController`, the next sensible cluster is the `AgentCalls` / `OpenAiProxy` pair (ranks 5 and 9) — they form the ingestion pipeline that's core to the product, and `OpenAiProxyController` has 13 commits of churn with zero tests guarding it.

## Next step

Want me to draft the first test class — `StatisticsServiceTests` extending `BaseTest<Module>` against the in-memory DB, covering the happy paths for each of the 16 public members? That would burn down roughly half of rank 6 and tee up rank 4 with the fixtures already wired up.
