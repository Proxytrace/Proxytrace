# Performance Engineering as a First-Class Practice

Systems that store unboundedly-growing data get slow in ways functional tests can never see: a query that is correct and instant on 100 rows becomes a multi-second table scan at a million. Performance must therefore be engineered like correctness — with executable specifications (budgets in version control), a dedicated suite that measures real code paths at realistic volume, and a hard rule that ties every change on a hot path to a measurement.

## Principles

- **Correctness tests cannot guard performance.** Unit suites run on tiny datasets, often on an in-memory provider with no real indexes, no query planner, and no native SQL functions. They never see a query plan, so they miss the three classic scale bugs: client-side evaluation (the ORM silently materializes the table), bad plans (the planner picks a nested loop that random-reads everything), and O(rows) algorithms (work proportional to table size instead of result size).
- **Budgets are absolute numbers committed to version control.** Not "no slower than last run" (drift-prone) and not aspirational targets (permanently red, so ignored) — measured p95/mean plus explicit headroom, checked in as a single JSON file that every measurement scope reads and fails against.
- **The suite must stay green so that any red means a regression.** A perf suite people expect to be partially red trains everyone to ignore it. Calibrate budgets to reality, document the reasons, and treat every breach as a defect to chase.
- **Measure real paths through real infrastructure.** Time the production repositories/readers resolved from the production DI graph against the production database engine, not a reimplementation of the query. Anything else measures the wrong thing.
- **Performance work is change-coupled.** The rule is mechanical: *touch a query, mapping, or index on a high-volume table → add or extend a perf scenario for that path, with a budget.* No exceptions for "obviously fine" changes — the two worst regressions are always obviously fine in review.

## Patterns

### Absolute budgets in one committed file

**Problem:** Perf knowledge lives in heads ("the dashboard used to be ~300ms") and evaporates; regressions land unnoticed and get expensive to bisect months later.

**Solution:** One `perf-budgets.json` at the repo root of the perf suite — the single source of truth read by every measurement scope (DB-layer runner, HTTP load tool, micro-benchmark harness). Any scope exits non-zero on breach. Conventions that make it work:

- **A missing key means "measure but never fail"** — a new scenario can land and produce numbers before anyone commits to a budget.
- **Budgets carry their provenance as comments**: when calibrated, on what data size and hardware, what the measured plan was, and what the known "next lever" is if the budget is ever blown (e.g. "a NULLS-LAST composite index pair would fix this — deliberately not paid while worst case sits at ~400ms").
- **The regression signature is documented next to the number**: "losing this index means a full scan at 250ms+, budget is 25ms" turns a red into a diagnosis.

```json
{
  "ingestion":   { "writesPerSecMin": 150 },
  "dbQueryP95Ms": { "listByOwner": 40, "timeSeriesAggregate": 1200, "recentWindow": 25 },
  "httpP95Ms":   { "dashboard": 2500 },
  "benchmarkMeanUs": { "payloadDeserialize": 80 }
}
```

**Rationale:** A number in version control is reviewable, bisectable, and enforceable in CI. A number in someone's memory is none of those.

### A dedicated, opt-in perf suite at realistic volume

**Problem:** Running perf checks on every push is too slow and too noisy; not running them at all means scale bugs ship.

**Solution:** A separate `perf/` suite, explicitly excluded from the normal test run, executed on demand (a shell entrypoint plus a manually-triggered CI workflow). It boots a throwaway stack (real database on a side port, real API), **seeds ~1M rows** into the highest-volume table, runs its scopes, writes JSON results, and tears down. Split measurement into three scopes because they catch different regressions:

| Scope | Measures | Catches |
|-------|----------|---------|
| DB-layer | p95 latency of each hot query + write throughput, in-process against the seeded DB | Plan regressions, lost indexes, client-side eval |
| HTTP load | Read endpoints under concurrent virtual users | Contention, N+1 across the request, serialization stacking |
| Micro-benchmarks | Pure-CPU per-row costs (e.g. payload (de)serialization on the ORM value-converter hot path) | Per-row cost creep that multiplies by volume |

**Seeding rules:** build a small fixed graph of parent entities, then bulk-insert the high-volume rows **through the production write path** (real mappers/repositories, batched), with realistic distributions — timestamps spread over months, realistic value distributions, a few percent errors, correlated child rows. Use a factory that lets the seeder stamp timestamps; do not use per-row test-object generators that create a fresh parent graph per row. Support a `--size` flag so a 100k smoke run exists alongside the canonical full run.

**Rationale:** Realistic volume *and* realistic distribution matter — planner behavior, index selectivity, and null-handling all depend on the data's shape, not just its count.

### The hard rule: touch a hot query → extend a perf test

**Problem:** Perf suites rot because nothing forces them to grow with the code.

**Solution:** A written, non-negotiable rule in the repo's top-level agent/contributor instructions: any change to a query, repository, ORM mapping, or index on a high-volume table **must** add or extend a perf scenario measuring the changed path against a budget, and the author must sanity-check with the tools below before merging. A correctness test on a few in-memory rows explicitly does not satisfy the rule.

**Rationale:** The rule converts perf coverage from a virtue into a merge criterion. Its cost is small (one scenario, one budget line) precisely because the harness already exists.

### Sanity tools: SQL inspection and EXPLAIN ANALYZE

**Problem:** Even experts misdiagnose slow queries. (Real example: a 4-second aggregate was blamed on client-side evaluation of a numeric cast; the SQL was in fact fully server-side — the cause was elsewhere.)

**Solution:** Two cheap tools, used in order:

1. **Render the query to SQL** (`ToQueryString()` or the ORM's equivalent) against the production provider's translator — this needs no live database and can be locked into a fast unit test asserting the aggregate/`GROUP BY` is server-side. This eliminates or confirms client-side evaluation in seconds.
2. **`EXPLAIN (ANALYZE)` the rendered SQL** on the seeded database and compare the planner's **estimated vs. actual row counts** before assuming the query itself is wrong. A huge mismatch means the planner is working from bad statistics, not that your SQL is bad.

**Rationale:** The same SQL can run 10× apart under different plans. Diagnosing at the SQL level first, then at the plan level, prevents "fixing" queries that were never broken.

### Planner-statistics hygiene

**Problem:** A bulk-loaded table has no planner statistics; the planner assumes it's tiny and picks a nested-loop plan that random-reads the whole table — one observed case ran ~3.5s where the identical SQL ran ~300–500ms once analyzed. Production tables that grow fast can hit the same cliff between auto-analyze passes.

**Solution:** The seeder runs `ANALYZE` after every bulk load, so the suite measures the steady-state plan rather than an artifact. In production, tune per-table auto-analyze thresholds on the fastest-growing table (via a migration, so it's versioned) so statistics keep pace with ingestion. Keep the failure mode documented in the budget file: a return of the bad plan blows the budget and the suite catches it.

**Rationale:** This is the canonical "bad plan" scale bug, and it is invisible to any test that doesn't run the real planner on realistic volume.

### Calibrate budgets to measured p95, then defend the green

**Problem:** Uncalibrated budgets are either too loose (regressions pass) or too tight (permanent red, alarm fatigue).

**Solution:** New scenarios start as measure-only (no budget key). After the first full-size run on representative hardware, set each budget ~20–30% above the observed p95/mean and mark provenance. Recalibrate on hardware changes and after deliberate trade-offs (e.g. widening a hot row for a feature — remeasure and move the budget with a comment, don't let it silently absorb the cost). Distinguish honest cases:

- **Scan-bound floors:** some full-window aggregates are one scan of the window — no index helps; the budget encodes the scan cost and the comment names the next lever (pre-aggregated rollups) for when volume outgrows it.
- **Measurement contamination:** a scenario over a trailing time window climbs across back-to-back iterate runs as each run's own probe rows accumulate inside the window. Budget for the canonical fresh-seed run plus a few iterations, document the pattern, and note "re-seed before chasing a regression" — while keeping the budget far below the real regression signature.
- **Cold vs. warm:** decide which the budget covers and say so.

**Rationale:** A calibrated, annotated, all-green suite gives one bit of unambiguous signal per scenario: red = someone changed the performance of this path. That bit is only trustworthy if greens are defended and every red is explained or fixed.

## Pitfalls

- **Trusting the in-memory test provider.** It runs LINQ over objects: no indexes, no plans, missing SQL functions, sync-under-async. It cannot surface any perf regression; treating its speed as evidence is the root failure this whole practice guards against.
- **Seeding through per-row test factories.** Convenience generators that build a full parent graph per row produce unrealistic data shape and glacial seeds; bulk-build against a small fixed graph instead.
- **Relative ("no slower than last run") thresholds.** They ratchet downward as slow creep gets baked into each new baseline. Absolute budgets don't drift.
- **Aspirational budgets.** Setting targets the code doesn't meet makes the suite red-by-default and ignored. Encode reality plus headroom; track aspirations as issues.
- **Benchmarking a reimplementation.** Timing a hand-written "equivalent" query, or the ORM path against a hand-tuned raw-SQL baseline on a differently-warmed table, produces phantom 1000× gaps. Same code path, same database state.
- **Forgetting the write path.** Read latency gets all the attention; ingestion throughput (per-row cost on the write hot path, including denormalized-column computation) regresses just as silently. Budget it.
- **Running perf checks in the merge gate.** Multi-minute seeded runs on shared CI hardware are noisy and slow; keep the suite opt-in/manual with strong norms (the hard rule) about when it must be run.

## Checklist for a new project

- [ ] Identify the high-volume tables (anything append-heavy or unboundedly growing) and list their hot read paths and the write hot path.
- [ ] Create `perf/` with: a seeder (~1M rows through production write code, realistic distributions, `ANALYZE` after load, `--size` flag), a DB-layer scenario runner over the real DI graph, an HTTP load script, optional micro-benchmarks — all excluded from the normal test run.
- [ ] Commit `perf-budgets.json`: shared by all scopes, non-zero exit on breach, missing key = measure-only, comments carry calibration provenance and regression signatures.
- [ ] One entrypoint (`perf/run.sh`) that boots a throwaway stack, seeds, measures, writes JSON results, tears down; plus a manually-triggered CI workflow.
- [ ] Write the hard rule into contributor/agent instructions: high-volume query change ⇒ perf scenario + budget + `ToQueryString`/`EXPLAIN (ANALYZE)` sanity check.
- [ ] Add fast unit tests that lock hot aggregates to server-side SQL translation (no live DB needed).
- [ ] Tune per-table auto-analyze on the fastest-growing table via a versioned migration.
- [ ] After the first full run, recalibrate every budget to measured p95 + 20–30%; from then on, keep the suite green and treat every red as a defect.
