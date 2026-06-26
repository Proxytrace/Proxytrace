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

## First finding (issue #246)

On its first 1M-row run the suite caught a real bug: the project-wide statistics aggregations
(`GetSummaryAsync`, `GetTokenUsageAsync`, `GetModelBreakdownAsync`, `GetCostEstimateAsync`,
`GetCallTrendsAsync`, `GetLatencyAsync`) take **3.7–4.4 s** at 1M rows, while the equivalent raw SQL
aggregate runs in **<1 ms** — they fall back to **client-side evaluation** (materialising every row,
including the JSON payload columns) because the `ulong?→numeric` token `Sum()`s don't translate.
`COUNT`-only and index-backed queries stay fast. The `stats*` (and `httpP95Ms.statisticsDashboard`)
budgets are set to **target** values — a few hundred ms, which the <1ms raw SQL aggregate shows is
achievable — so the suite is **intentionally RED on those metrics until #246 lands** and stays an active
reminder. Everything else is green. When #246 is fixed, those metrics should pass at the target without
loosening.
