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

## Release-risk interpretation

The headline risk for this release is the **API + Statistics stack**. Trsr.Api sits at **8.3% line / 5.8% branch coverage** — effectively untested — yet it is the public surface every client and the React frontend talks to. Trsr.Application is at **46.3% line but only 10.1% branch**, meaning the orchestration layer's conditional paths (error handling, retries, status transitions) are almost entirely unexercised. Compare that to Trsr.Domain (75% / 33%) and Trsr.Common (92% / 30%): the safer layers are well covered, the dangerous ones are not. This is the classic inverted pyramid — most behavior lives in the layers least defended by tests.

Three concrete hot spots to fix before shipping:

1. **`Trsr.Api/Controllers/StatisticsController.cs` + `Trsr.Application/Statistics/Internal/StatisticsService.cs` + `Trsr.Storage/Internal/Statistics/AgentCallStatsQueries.cs`** — the entire statistics pipeline is zero-covered across all three layers, with very high complexity in the controller (65) and the queries (71). 16 public controller methods, 16 public service methods, and 10 public query methods all sit at 0% coverage. If statistics power the dashboard the user sees on login, any regression here ships silently. This is the single biggest regression risk in the report.

2. **`Trsr.Api/Controllers/TestRunsController.cs`** — 0% coverage with **24 commits in the last 90 days**, the highest churn in the file list, and complexity 36 across 6 public endpoints. High churn plus zero coverage plus a release window is the definition of "a hot file no one is guarding." Test-running is core product surface; a subtle bug in run creation, status, or cancellation will be felt immediately.

3. **`Trsr.Api/Controllers/OpenAiProxyController.cs`** — 0% coverage on the OpenAI-compatible proxy, complexity 34, churn 13. This is the ingress point for every external client trace; a failure here is not "the dashboard is wrong," it's "we drop or corrupt customer traffic." Smaller public surface (2 members) but the blast radius is the largest of any file in the list.

Secondary but worth a glance: **`AuthController`** (0% / 10 public members) shipped a "legacy user login" change in the most recent commit (`1b5524f`) — auth changes with zero coverage right before a release should not pass review. **`PlaygroundService`** has complexity 64 at 0% coverage; even a couple of happy-path tests would close a large branch-coverage gap.

## Suggested next step

Want me to draft a first round of controller-level tests for the Statistics pipeline (controller -> service -> queries)? That single vertical slice would knock the highest-scored risk off the list and give you a template to fan out to the other zero-covered controllers (TestRuns, OpenAiProxy, Auth) before the release. If you'd rather plan than execute, the per-layer table above is the right view: focus the sprint on Trsr.Api and the branch-coverage hole in Trsr.Application, and leave Trsr.Domain / Trsr.Common alone.
