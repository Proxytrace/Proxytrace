# Test Runs UI Rework — Design

**Date:** 2026-06-07
**Branch:** kiosk-interactive-mode (rework lands here or a fresh branch off master)
**Scope:** Full redesign of the run-detail UI (`frontend/src/features/runs/`). Frontend only — backend SSE + DTOs confirmed correct and unchanged.

## Problem

During an active test run the run-detail UI is unstable and inconsistent:

1. **Flicker / inconsistent states.** SSE updates cause the UI to churn between states.
2. **Evaluators not shown during runs.** Per-evaluator dots appear only after a run finishes.
3. **Model performance summary only for multi-model.** Single-model runs get no summary card.

The run-detail page serves three equally important jobs: **watch live progress**, **compare models**, **debug failures**. The redesign must serve all three and present a stable, legible live experience.

## Diagnosis (verified against code)

The backend is healthy — no backend changes needed:

- `EvaluationArrivedEvent` is published per-evaluator as each finishes (`Proxytrace.Application/TestRun/Internal/TestRunnerService.cs:303`). Evaluators run in parallel, no batching.
- `TestRunDto.testCases` and `.evaluators` are populated upfront from the suite, before any results exist (`Proxytrace.Api/Dto/TestRuns/TestRunDtoMapper.cs:48,52`).

So the full (cases × models × evaluators) shape is known to the frontend at run start, and evaluations stream incrementally. Every fix is a frontend/UX one.

### Root causes

1. **Flicker / inconsistent states.** Row order is already frozen during active runs (`MatrixView.tsx:27`), so rows do not reshuffle. The real churn:
   - **Comparative judgments recompute every frame** — multi-model leaderboard winner badges (Best/Fast/Cheap) flip between models as partial data lands. Worst offender.
   - Footer pass-rate and segmented-control counts tick every flush.
   - Pass-rate coloring jumps alarmingly on partial data (e.g. 73% → 50% → 80%).
2. **Eval dots "missing" during run.** Live dots *do* render (`MatrixCell.tsx:39`) but only within each cell's brief running window, and **there are no placeholder slots** — a cell shows nothing until the first evaluation lands, and inference time dominates that window. Easy to miss, especially single-model where one cell streams at a time.
3. **Summary only for multi-model.** `{multipleRuns && <ModelLeaderboard/>}` gates it out for single-model (`GroupDetail.tsx:32`); single-model folds a few stats into the header instead.

## Design decisions

- **Full redesign** of the run-detail UI (not just bug fixes), serving the three jobs equally.
- **Unify** single- and multi-model layout — single-model is the N-of-1 case of the same components. Always render the performance summary.
- **Stable scaffold** — render the full (cases × models) grid as pending placeholders at run start; cells only transition in place (pending → running → done); order frozen; counts monotonic.
- **Evaluator slots** — each cell renders one grey slot per evaluator immediately (count from `run.evaluators.length`), filling pass/fail/error as each `evaluation-arrived` lands. Live progress visible regardless of timing.
- **Suppress volatile verdicts while active** — winner badges, "best" coloring, and final-looking judgments render only once the run settles. During the run: show progress, not comparative conclusions.
- **Keep the comparison drawer** for case-level debugging (click cell → side drawer with input / output / per-evaluator verdict + reasoning).

## Page structure

Identical for single- and multi-model:

```
┌─ RunGroupHeader ─────────────────────────────┐
│ suite · agent · status · RunProgressBar       │  live: X/Y cases done · % · ETA
├─ PerformanceSummary (ALWAYS) ─────────────────┤
│ grid of 1..N ModelSummaryCard                 │  pass rate, cases, latency, cost, tokens
│ winner badges only when run COMPLETE          │
├─ EvaluatorHeatmap ────────────────────────────┤
│ evaluators × models score distribution         │
├─ Matrix (cases × models) ─────────────────────┤
│ stable scaffold; pending → running → done      │
│ each cell: EvalSlots (grey → filled)           │
│ click cell → ComparisonDrawer (kept)           │
└────────────────────────────────────────────────┘
```

## Component breakdown

Feature folder `frontend/src/features/runs/`. Conforms to BEST_PRACTICES (≤300 lines/file, one component per file, pure logic in `.ts`, no raw `useQuery` in pages). No file exceeds 300 lines after changes.

### Orchestration
- **`GroupDetail.tsx`** — composition only. Subscribes `useRunGroupStream`, derives `active` once, lays out Header → PerformanceSummary → Heatmap → Matrix. No single/multi branching. Threads `active`/`complete` down as the single source for verdict suppression.

### Header
- **`components/RunGroupHeader.tsx`** — suite · agent · status badge. Stops folding single-model stats inline (those move to the summary). Hosts `RunProgressBar`.
- **`components/RunProgressBar.tsx`** *(new)* — live `X/Y cases · Z%`, determinate bar from monotonic done-count across all runs. ETA shown only when ≥1 case done (avg duration × remaining). Hidden when complete.

### Performance summary (unify — replaces ModelLeaderboard)
- **`components/PerformanceSummary.tsx`** *(rename of `ModelLeaderboard`)* — grid of `1..N` `ModelSummaryCard`. Always rendered.
- **`components/ModelSummaryCard.tsx`** *(rename of `ModelLeaderboardCard`)* — pass rate, pass/fail/total, avg latency, cost, tokens. Renders for single-model too. **Winner badges gated on `complete`, not `multi`.** While active: provisional values shown plain/muted, no badge; settled: authoritative + badged.

### Matrix (stable scaffold)
- **`MatrixView.tsx`** — grid shell, toolbar, footer. Already seeds rows from `testCases` (`results.ts:191`); ensure pending cells render from t0 with zero results. Footer pass-rate muted while active.
- **`components/MatrixCell.tsx`** — three lifecycle branches kept (done / running / pending). Running *and* pending branches both render `EvalSlots` (not bare `—`/empty).
- **`components/EvalSlots.tsx`** *(new, extracted from `EvalDots`)* — renders `total` slots: filled (pass/fail/error color) for arrived evaluations, grey for not-yet-arrived. Props `{ arrived: EvaluationResultDto[]; total: number }`. Done = all filled, running = partial, pending = all grey.

### Heatmap
- **`EvaluatorHeatmap.tsx`** / **`DistributionBar.tsx`** — structurally unchanged; verify they read the live fold so distribution fills during the run.

### Live-state model (pure logic, `.ts`, unit-tested)
- **`live.ts`** — reducer unchanged (confirmed correct).
- **`results.ts`** — `buildMatrixCell`: pending cell carries `progress: { done: 0, total: run.evaluators.length }` so `EvalSlots` knows the slot count before any event. Add a `runComplete(runs)` helper (`!runs.some(isActive)`) as the single source for verdict suppression.
- **`comparison.ts`** — `buildLeaderboard` gains a `complete` flag; winner computation is skipped (no winners) until settled, eliminating badge flicker.

### Verdict-suppression rule (one place)
`active` derived once in `GroupDetail`, threaded down. While active: no winner badges; summary cards show provisional muted numbers; matrix footer pass-rate muted. On settle: everything authoritative.

### File summary
- **New:** `RunProgressBar.tsx`, `EvalSlots.tsx`.
- **Renames:** `ModelLeaderboard → PerformanceSummary`, `ModelLeaderboardCard → ModelSummaryCard`.
- **Edited:** `GroupDetail`, `RunGroupHeader`, `MatrixView`, `MatrixCell`, `results.ts`, `comparison.ts`.

## Live update flow & flicker elimination

Keep the existing transport — it works:
- `useRunGroupStream` coalesces events per `requestAnimationFrame`, folds into the `live` map, and patches the query cache in place. No refetch on SSE.
- `allRows = useMemo([runs, live])` rebuilds each flush (new Map ref). Acceptable: frozen order + stable cell keys (`caseId`, run index) mean React reconciles in place — content updates, no DOM reorder.

The flicker fixes:
1. **Winner badges gated on `complete`** — no recompute-driven flipping mid-run. Biggest visible fix.
2. **Monotonic counters** — done-count and pass/fail only increase (results upsert, never removed; already monotonic in `withCounts`). Verify segmented-control counts never decrease.
3. **Provisional vs authoritative** — muted pass-rate coloring/badges while active; numbers still update but are not dressed as final, so no alarming color jumps on partial data.
4. **Eval slots** — grey → color fill is additive and in place; no empty → appear pop.

Net effect: cells fill in place, counts climb, nothing reshuffles or flips.

## Testing

Vitest `.spec.ts` on pure logic; component tests for the new UI:
- **`results.spec.ts`** — `buildMatrixCell` pending carries `{ done: 0, total: evaluators.length }`; running partial; done full. `runComplete` helper.
- **`comparison.spec.ts`** — `buildLeaderboard` returns no winners when `complete=false`; correct winners when true.
- **`live.spec.ts`** — existing reducer tests stay green.
- **Component** — `EvalSlots` renders `total` slots, fills by arrived count, colors correctly. `ModelSummaryCard` hides badges while active. `RunProgressBar` math + ETA gating.
- **e2e** — keep `matrix-cell-running-*` testid; add `eval-slot` testids; confirm dots visible mid-run via the running-cell window.

Verify with `npm run build` (typing), `npm run lint`, `npm test` after each change.

## Documentation

Update `manual/guide/` run page: describe the live progress bar, evaluator slots, the unified per-model summary, and "verdicts finalize when the run completes." Build the manual to verify (`cd manual && npm run docs:build`).

## Out of scope (YAGNI)

- Backend changes — SSE + DTOs are correct.
- Heatmap visual redesign.
- Comparison drawer redesign (kept as-is).
- The bounded-channel `DropOldest` concern — healed by the terminal `invalidateQueries` on `group-run-complete`.
