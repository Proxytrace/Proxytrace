---
name: run-perf-tests
description: >-
  Run, interpret, and iterate on the Proxytrace performance suite under `perf/`
  locally — the opt-in harness that seeds ~1M agent calls into real Postgres and
  measures ingestion throughput, statistics/query latency, HTTP load, and JSON
  micro-benchmarks against absolute budgets. Use this whenever the task is to
  EXECUTE perf tests and make sense of the result — "test performance locally",
  "run the perf suite", "is the app still fast with lots of data", "is ingestion
  fast at scale", "are the statistics queries fast at a million rows", "check for
  a performance regression", "seed a million traces and measure", "load test the
  API", "benchmark serialization", "why is the perf suite red", "did my change
  slow down queries", "what's the dashboard latency at scale". Covers picking a
  scope (db-layer / http / benchmarks), full-run vs seed-once-iterate, the
  Postgres/API ports, reading `perf/results/*.json`, and the budgets in
  `perf/perf-budgets.json` (recalibrated to real measured p95 — the suite should
  run all-green, so any red is a regression to chase). This is for RUNNING the
  suite — to change what it measures, read `docs/performance-testing.md` and edit
  `perf/` directly.
---

# Running & Interpreting the Proxytrace Performance Suite

The perf suite lives at the **repo root in `perf/`**. It is **opt-in and
run-on-demand** — never on push/PR — because it seeds ~1M rows and boots a full
stack (minutes). It exists because the unit suite runs on the in-memory EF
provider, whose query semantics (no real indexes, no `percentile_cont`) cannot
surface perf regressions. The authoritative design reference is
**`docs/performance-testing.md`**; `perf/README.md` is the operator quick-ref.
This skill is the fast path for *running and interpreting*.

The `.NET` pieces are console apps **deliberately excluded from
`dotnet test Proxytrace.sln`** — run them only via `perf/run.sh` or directly with
`dotnet run --project perf/...`. They boot the **real** Storage+Application graph
against **real Postgres**, so they need Docker.

## Prerequisites
- **Docker** + **dotnet 10** — required for `db-layer` and `http`.
- **k6** — required only for the `http` scope (skipped with a warning if absent;
  install: <https://k6.io/docs/get-started/installation/>).
- The `benchmarks` scope needs neither Docker nor k6 (pure CPU, no DB).

## The golden path

From the **repo root** (not `perf/`):

```bash
perf/run.sh                                       # full suite, ~1M rows (db-layer + http + benchmarks)
perf/run.sh --size 100000 --scopes db-layer,benchmarks   # quick smoke (seconds-to-a-minute)
perf/run.sh --scopes benchmarks                   # CPU only, no Docker
perf/run.sh --scopes http --vus 25 --duration 60s --keep # heavier load, leave the stack up
```

`run.sh` does the whole cycle: boots a throwaway stack
(`docker-compose.perf.yml` — Postgres on **:5433**, API on **:5230**), seeds,
runs the requested scopes, writes `perf/results/*.json`, and tears the stack down
(`--keep` leaves it up). First API image build takes a few minutes.

Flags: `--size N` · `--scopes all|db-layer,http,benchmarks` · `--vus N` ·
`--duration 30s` · `--keep`. Each scope **exits non-zero on a budget breach**, and
`run.sh` returns non-zero if any scope failed.

## Size matters — scan-bound costs only show at scale

The heavy statistics aggregations are **scan-bound**: their real cost only appears
at ~1M rows. At `--size 100000` they finish well inside budget regardless, so a
100k run **can't** catch a planner/index regression or a return of the old issue
#246 client-eval cliff (now fixed — see below). Use:
- `--size 100000` for a fast "did I break the wiring / the fast queries" check.
- `--size 1000000` (the default) to actually exercise the at-scale query plans.
  Seeding 1M takes ~3.5 min (~5k rows/s); the seeder then runs **`ANALYZE`** so the
  planner has fresh statistics (a bulk load *without* it picks a nested-loop plan
  and the stats queries balloon to ~4 s — that is the original #246 symptom). The
  db-layer run itself is then a couple of minutes.

## Full run vs seed-once-and-iterate

```dot
digraph choose {
  "What are you doing?" [shape=diamond];
  "One clean pass / CI-style verdict" [shape=box];
  "Tuning a query, re-measuring repeatedly" [shape=box];
  "run.sh (manages + seeds + tears down)" [shape=box];
  "Seed ONCE, keep the DB, re-run db-layer against it" [shape=box];

  "What are you doing?" -> "One clean pass / CI-style verdict" -> "run.sh (manages + seeds + tears down)";
  "What are you doing?" -> "Tuning a query, re-measuring repeatedly" -> "Seed ONCE, keep the DB, re-run db-layer against it";
}
```

Do **not** loop `run.sh` while tuning — every call re-seeds 1M rows (minutes
wasted). Instead bring the stack up once, seed once, and re-run just the
DB-layer scenarios against the kept database:

```bash
# repo root — boot postgres (the db-layer runner needs only Postgres; add `api` if you also want http)
docker compose -f docker-compose.yml -f perf/docker-compose.perf.yml up -d --wait postgres

export PROXYTRACE_PERF_CONNECTION="Host=localhost;Port=5433;Database=proxytrace;Username=proxytrace;Password=proxytrace"

# seed once
dotnet run --project perf/Proxytrace.PerfHarness -c Release -- seed --size 1000000

# re-run query latency as many times as you like (no re-seed) — tune, rebuild, repeat
dotnet run --project perf/Proxytrace.PerfHarness -c Release -- db-layer --iterations 10 --out perf/results/db-layer.json

# tear down when done
docker compose -f docker-compose.yml -f perf/docker-compose.perf.yml down -v
```

The `db-layer` command applies migrations (idempotent), discovers a seeded agent
+ project from the data, and times the readers — it does **not** re-seed, so it
is safe to run repeatedly. `--iterations` controls timed reps per query (warmup
defaults to 2; pass `--warmup N` to change it); `--ingest-count` /
`--ingest-concurrency` size the throughput
probe. Benchmarks rebuild fast and need no DB:
`dotnet run --project perf/Proxytrace.Benchmarks -c Release` (Release is required
— BenchmarkDotNet refuses a Debug build).

## The three scopes

| Scope | Measures | Engine | Needs |
|-------|----------|--------|-------|
| `db-layer` | statistics/list/histogram query latency (p95) + write-ingestion throughput | `Proxytrace.PerfHarness` (real readers against seeded Postgres) | Docker, dotnet |
| `http` | dashboard / agent-calls list / agent distributions under concurrent VUs | k6 vs the running API | Docker, dotnet, **k6** |
| `benchmarks` | per-row JSON serialize/deserialize (the EF value-converter hot path) | BenchmarkDotNet | dotnet only |

## Interpreting the result

Each scope prints a `metric | measured | budget | status` table and writes a JSON
result to `perf/results/` (`db-layer.json`, `k6-summary.json`, `benchmarks.json`).
`RESULT: PASS/FAIL` and the exit code are driven by
**`perf/perf-budgets.json`** — the single source of absolute budgets shared by all
three scopes.

### The suite should be all-green — a red is a real regression
Issue #246 (statistics aggregations client-evaluating to ~4 s at 1M) is **fixed
and closed**. The fix was *not* a query rewrite — the token-sum casts already
translate to a server-side `bigint` `SUM`. The real cause was **stale planner
statistics** after the bulk seed (a nested-loop plan random-reading ~900k heap
blocks → ~3.5 s; the same SQL drops to <500 ms once analyzed). What landed: the
seeder runs **`ANALYZE` after seeding**, a migration (`TuneAgentCallAutovacuum`)
lowers the autovacuum analyze threshold on `AgentCallEntity`, `GetLatencyAsync`
uses `percentile_cont(ARRAY[…])`, and the budgets in `perf-budgets.json` were
**recalibrated to real measured p95**. So every metric is now **green-expected** —
a FAIL is a regression to chase, not a known signal.

Reference numbers from a healthy 1M run (≈measured | budget, all PASS):

| Metric (db-layer) | ≈measured | budget |
|-------------------|-----------|--------|
| `agentCallsList` / `…ByAgent` / `…ByTimeRange` / `…Histogram` | 6–31 ms | 40–150 ms |
| `statsSummary` / `statsAgentBreakdown` | 224–257 ms | 500 ms |
| `statsModelBreakdown` / `statsCostEstimate` | 289–299 ms | 600 ms |
| `statsCallTrends` | ~743 ms | 1100 ms |
| `statsLatencyPercentiles` / `statsTokenUsage` | 826–836 ms | 1200 ms |
| `agentOverview` / `agentDistributions` | 57–68 ms | 250 ms |
| `testRunStatsBySuite` / `…BySuitePage` | 1–22 ms | 60–90 ms |
| `ingestThroughput` | ~846 calls/s | ≥150 calls/s |

The three heaviest stats queries (`statsCallTrends`, `statsLatencyPercentiles`,
`statsTokenUsage`, ~740–880 ms) are **scan-bound** — comfortably under budget at
1M, but the first thing to watch at 10M; pre-aggregated rollups are the only
sub-second-at-10M lever. Benchmarks (JSON serialize/deserialize) run ~1–3 ms vs
40–80 ms budgets.

### So: how to read a run
1. **Every metric is green-expected.** A FAIL is a real regression your change (or
   the data shape) introduced — investigate the query / index / plan.
2. If the heavy stats queries jumped back to **multi-second**, suspect a missing
   `ANALYZE` / stale stats (was the seed interrupted before the analyze step?) or a
   plan regression — `EXPLAIN (ANALYZE)` and compare **estimated vs actual** rows
   before blaming translation.
3. An infra failure (seed / migration / Docker) is **not** a perf signal — see triage.

## Triage: real regression vs stale-stats vs infra

```dot
digraph triage {
  "A metric is FAIL" [shape=diamond];
  "A query metric went red" [shape=box];
  "heavy stats back to multi-second" [shape=box];
  "http scope didn't run at all" [shape=box];
  "stack/seed errored before any metric" [shape=box];

  "REGRESSION: your change (or the data) slowed it — investigate the query/index/plan" [shape=box];
  "STALE STATS / plan regression — check the seed ran ANALYZE; EXPLAIN ANALYZE est-vs-actual rows" [shape=box];
  "k6 missing or API unhealthy — install k6 / check the stack" [shape=box];
  "INFRA: Docker/migrations/seed failure — not a perf signal" [shape=box];

  "A metric is FAIL" -> "A query metric went red" -> "REGRESSION: your change (or the data) slowed it — investigate the query/index/plan";
  "A metric is FAIL" -> "heavy stats back to multi-second" -> "STALE STATS / plan regression — check the seed ran ANALYZE; EXPLAIN ANALYZE est-vs-actual rows";
  "A metric is FAIL" -> "http scope didn't run at all" -> "k6 missing or API unhealthy — install k6 / check the stack";
  "A metric is FAIL" -> "stack/seed errored before any metric" -> "INFRA: Docker/migrations/seed failure — not a perf signal";
}
```

## Common signatures

| Symptom | Cause | Action |
|---------|-------|--------|
| Heavy `stats*` aggregates back to ~4s, dashboard ~5s, FAIL | Stale planner stats — the seed's post-load `ANALYZE` didn't run (interrupted seed?), or a plan regression (the old #246 symptom) | Re-seed cleanly (or `ANALYZE` the DB); `EXPLAIN (ANALYZE)` est-vs-actual rows before blaming translation |
| Green at `--size 100000` but a query regressed at `1000000` | Scan-bound costs only bite at scale | Validate query changes at ~1M, not 100k |
| `http` scope says "k6 not installed — skipping" | No k6 on PATH | Install k6; only then does the http scope run |
| Seed fails on `IX_AgentVersionEntity_Project_Fingerprint` / `IX_ModelEndpoint…` | Stale/dirty DB from a half-run | `docker compose -f docker-compose.yml -f perf/docker-compose.perf.yml down -v`, re-run (the seeder assumes a fresh DB) |
| `No agent calls found — run seed first` (db-layer) | Ran db-layer against an unseeded DB | Run `seed` (or `run.sh`, which seeds) first |
| `--wait` never returns | A container is unhealthy | `docker compose -f docker-compose.yml -f perf/docker-compose.perf.yml ps` / `logs` |
| db-layer connection refused | Postgres not up, or wrong port | Stack maps Postgres to **:5433** (not 5432); check `PROXYTRACE_PERF_CONNECTION` |
| BenchmarkDotNet refuses to run | Built in Debug | Use `-c Release` |
| Ingestion throughput low / 0 | Seeded agents/endpoints missing | Seed first; the throughput probe reuses seeded agents |

## Ports — perf stack ≠ e2e/dev stacks
The perf overlay exposes **Postgres :5433** (host-reachable for the in-process
seeder) and **API :5230**. That is distinct from the e2e stack (frontend :5101,
api :5100) and the `./dev.sh` stack (:4201/:5001). Point `curl`/k6/the connection
string at **:5433 / :5230** during a perf run.

## Reporting back — be honest
- State the verdict plainly. The suite is **green-expected end to end**, so
  "overall PASS — every db-layer/benchmark metric under budget" is the healthy
  report. Any FAIL is a regression — don't wave it off as expected.
- For a red, give the metric, the measured-vs-budget, and your read (query change /
  missing index / stale stats / data shape).
- Quote actual numbers from `perf/results/*.json`, not impressions.
- If **Docker is unavailable**, say so — do not claim the suite passed. You can
  still run `--scopes benchmarks` (no Docker) and report that the DB-layer/HTTP
  scopes could not run.
- If you ran at `--size 100000`, **say so** — scan-bound query costs don't appear
  at that size, so an all-green small run is not evidence the at-scale path is
  healthy.
```
