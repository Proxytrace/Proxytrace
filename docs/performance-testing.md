# Performance testing

Proxytrace must stay fast as stored data grows — fast ingestion (write hot path) and fast
statistics/queries (read hot paths) even at millions of `AgentCall` rows. The unit suite cannot guard
this: it runs on the **in-memory EF provider**, whose query semantics differ from Postgres (no real
indexes, no `percentile_cont`, LINQ-sort fallbacks), so it never sees a real query plan. The perf suite
under [`perf/`](../perf/) fills that gap.

It is **opt-in and run-on-demand** — never on push/PR. Everything lives in `perf/`; the `.NET` pieces are
console apps deliberately **excluded from `dotnet test Proxytrace.sln`** (they boot the real graph
against real Postgres, which the in-memory unit suite must never do).

## The three scopes

| Scope | Measures | Tool |
|-------|----------|------|
| **DB-layer** | Statistics/list/histogram query latency (p95) + write-ingestion throughput, against ~1M seeded rows | `Proxytrace.PerfHarness` console |
| **HTTP load** | Read endpoints (`/api/statistics/dashboard`, `/api/agent-calls`, `/api/statistics/agents/{id}/distributions`) under concurrent VUs | `k6` (`perf/load/read-endpoints.js`) |
| **Micro-benchmarks** | Per-row JSON serialize/deserialize cost (the EF value-converter hot path), pure CPU | BenchmarkDotNet (`Proxytrace.Benchmarks`) |

## How the DB-layer harness reuses real code

`Proxytrace.PerfHarness/Bootstrap/PerfModule.cs` mirrors the proven `Proxytrace.Application.Tests`
container — a bare Autofac container with **no `IHost`**, so the ingestion worker and seeder
`IHostedService`s never auto-start — but points `StorageConfiguration.Postgres(...)` at the perf
database. It then resolves and times the **real** readers (`IAgentCallStatsReader`, `IAgentStatistics`,
`IAgentCallRepository`) and the real write path (`IAgentCallRepository.AddAsync`, one `SaveChanges` per
call — the per-envelope cost the ingestion worker pays). Infrastructure seams (model client, email,
search) are substituted because ingestion only parses captured bodies and persists them.

### Seeding (`Seeding/PerfDataSeeder.cs`)

A small fixed graph (1 project, ~10 endpoints from one provider + distinct models, ~50 agents each with
a distinct prompt fingerprint) is built through the production generators. The ~1M `AgentCall` rows are
built via the `IAgentCall.CreateExisting` factory — which lets the seeder stamp a controlled `CreatedAt`
(the mapper copies it verbatim) so rows spread over ~90 days — with realistic token/latency
distributions, ~5% errors, and ~30% multi-turn conversation grouping, then inserted in batches through
the real `AddRangeAsync`. (Do **not** use `IDomainEntityGenerator<IAgentCall>` for the bulk loop — it
creates a fresh agent/version/endpoint per call.)

The seeder also loads `TestRunStats` projection rows (default ~25k, scaled down for small `--size`)
spread across ~250 synthetic suites, for the suite-scoped query the test-suites controller runs (#253).
Because `TestRunStatsEntity.TestRunId` is a 1:1 FK to `TestRunEntity`, one real anchor suite/group is
built and a `TestRun` is inserted per stats row; the stats `SuiteId` is a plain indexed column (no FK),
so the suite spread is synthetic and needs no per-suite graph. The `TestRunStatsQueryScenario` then
times the scoped read (`WHERE SuiteId IN (...)`) for a single busy suite (`testRunStatsBySuite`, the
single-suite GET) and a 50-suite page (`testRunStatsBySuitePage`, the suites list). Their budgets are
**uncalibrated placeholders** — set conservatively for an index-scoped read — until a full run lands.

## Budgets (`perf/perf-budgets.json`)

The single source of absolute budgets, shared by all three scopes (the DB-layer runner and benchmarks
read it directly; k6 maps `httpP95Ms` onto its `thresholds`, which set the process exit code). A scope
exits non-zero on any breach. The committed values are **placeholders** — calibrate on the first full
~1M run, then set each budget ~20–30% above the observed p95/mean. A missing entry means "measure but
never fail", so a new scenario runs before its budget exists.

## Running

```bash
perf/run.sh                                   # full suite, ~1M rows
perf/run.sh --size 100000 --scopes db-layer   # quick smoke
```

`run.sh` boots `docker-compose.perf.yml` (Postgres `:5433`, API `:5230`), seeds, runs the scopes, writes
`perf/results/*.json`, and tears down. The API and the in-process harness **share one database** — the
harness seeds the rows the API serves. The statistics endpoints are project filters, not tenant security
boundaries, so the k6-bootstrapped admin sees all seeded data. CI: the manual **Performance** workflow
(`.github/workflows/perf.yml`, `workflow_dispatch`).

See [`perf/README.md`](../perf/README.md) for the operator-facing quick reference.

## First finding (issue #246) — stale planner statistics

On its first 1M-row run the suite measured the project-wide statistics aggregations
(`GetSummaryAsync`, `GetTokenUsageAsync`, `GetModelBreakdownAsync`, `GetCostEstimateAsync`,
`GetCallTrendsAsync`, `GetLatencyAsync`) at **3.7–4.4 s**. The first diagnosis (client-side evaluation
of `ulong?→numeric` token `Sum()`s) was **wrong**: `ToQueryString` and `EXPLAIN ANALYZE` show every one
of these translates to a single server-side `GROUP BY` / `sum` / `percentile_cont` and never reads the
JSON payload columns. The real cause was **stale planner statistics**: the seeder bulk-loads 1M rows in
one shot and (before the fix) never ran `ANALYZE`, so Postgres had no stats, defaulted to a wildly low
row estimate, and chose a **nested-loop plan that random-read the whole table** (≈3.5 s) instead of the
parallel seq-scan aggregate the same SQL runs once analyzed (≈270–480 ms). The author's `<1 ms` raw-SQL
baseline was on a settled, analyzed table — hence the apparent 1000× gap.

**Fixes (all landed):** the seeder now runs `ANALYZE` after the bulk load so the suite measures the
steady-state plan; migration `TuneAgentCallAutovacuum` lowers `autovacuum_analyze_scale_factor` on
`AgentCallEntity` so production stats stay fresh as the table grows; `GetLatencyAsync` uses a single
`percentile_cont(ARRAY[…])`. The `stats*` budgets are now **real measured p95 + headroom**, not targets.
After the fix everything is green except where noted: the three heaviest aggregates
(`statsLatencyPercentiles` ~880 ms full sort, `statsTokenUsage` / `statsCallTrends` ~780–880 ms bucketed
full scans) are **scan-bound** — no index helps a full-window aggregate, so sub-second at 10M+ would
require pre-aggregated rollups. A return to the nested-loop plan (e.g. a fresh restore without `ANALYZE`)
would blow past these budgets and the suite would catch it.
