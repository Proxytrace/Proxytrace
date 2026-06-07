# Test Runs UI Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the run-detail UI stable and legible during active runs — kill flicker, always show streaming evaluator progress, and render a unified per-model performance summary for single- and multi-model runs alike.

**Architecture:** Frontend only (`frontend/src/features/runs/`). Backend SSE + DTOs are confirmed correct and untouched — the full (cases × models × evaluators) shape is already known to the client at run start, and evaluations stream incrementally. The rework leans on a *stable scaffold* (every cell exists from t0, transitions in place), *evaluator slots* (grey placeholder dots that fill as evaluations arrive), *unified summary* (always render per-model cards), and *verdict suppression* (winner badges / comparative coloring only once the whole group settles).

**Tech Stack:** React 19, TypeScript, TanStack Query v5, Tailwind CSS 4, Vitest (node env — logic-only `.spec.ts`; no component-render tests in this repo). UI primitives from `frontend/src/components/ui/`.

**Mandatory reading before any code:** `frontend/DESIGN.md` (visual system) and `frontend/BEST_PRACTICES.md` (code architecture). Both checklists must pass.

---

## File Structure

**Pure logic (`.ts`, unit-tested in `results.spec.ts`):**
- `frontend/src/features/runs/results.ts` — add `runsComplete(runs)`, add `runGroupProgress(runs)`, give pending matrix cells an evaluator-slot count.
- `frontend/src/features/runs/comparison.ts` — `buildLeaderboard(runs, complete)` gains a required `complete` flag that suppresses all winners until the group settles.

**Components (presentational; verified by build + lint + e2e):**
- `frontend/src/features/runs/components/EvalSlots.tsx` *(new)* — N evaluator dots, filled or grey.
- `frontend/src/features/runs/components/RunProgressBar.tsx` *(new)* — live X/Y · % · ETA bar.
- `frontend/src/features/runs/components/MatrixCell.tsx` — running + pending branches render `EvalSlots`.
- `frontend/src/features/runs/components/ModelSummaryCard.tsx` *(rename of `ModelLeaderboardCard.tsx`)*.
- `frontend/src/features/runs/components/PerformanceSummary.tsx` *(rename of `ModelLeaderboard.tsx`)* — computes `complete`, always rendered.
- `frontend/src/features/runs/components/RunGroupHeader.tsx` — drop inline `SingleRunStats`, host `RunProgressBar`, unify meta line.
- `frontend/src/features/runs/MatrixView.tsx` — mute footer pass-rate while active.
- `frontend/src/features/runs/GroupDetail.tsx` — always render `PerformanceSummary`.

**Docs:** `manual/guide/` run page.

**Preserve these e2e testids** (used by `e2e/tests/test-run.spec.ts:143-145`): `data-testid="model-leaderboard"` and `data-testid="model-leaderboard-entry-${endpointId}"` survive the rename to `PerformanceSummary`. Also keep `matrix-cell-running-${run.id}`.

---

## Task 1: `runsComplete` helper

A single source of truth for "the whole group has settled" — consumed by the summary (Task 7) and leaderboard gating (Task 4).

**Files:**
- Modify: `frontend/src/features/runs/results.ts` (add after `isActive`, ~line 110)
- Test: `frontend/src/features/runs/results.spec.ts`

- [ ] **Step 1: Write the failing test**

Add to `results.spec.ts` inside the existing `describe('isActive', ...)` block or a new `describe('runsComplete', ...)` block near it. Import `runsComplete` from `./results` (add to the existing import list) and `TestRunStatus` is already imported.

```ts
describe('runsComplete', () => {
  const r = (status: TestRunStatus): TestRunDto => ({ status } as TestRunDto);

  it('is false when there are no runs', () => {
    expect(runsComplete([])).toBe(false);
  });

  it('is false while any run is pending or running', () => {
    expect(runsComplete([r(TestRunStatus.Completed), r(TestRunStatus.Running)])).toBe(false);
    expect(runsComplete([r(TestRunStatus.Pending)])).toBe(false);
  });

  it('is true once every run is in a terminal state', () => {
    expect(runsComplete([r(TestRunStatus.Completed), r(TestRunStatus.Failed)])).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/runs/results.spec.ts -t runsComplete`
Expected: FAIL — `runsComplete is not a function` / import error.

- [ ] **Step 3: Write minimal implementation**

In `results.ts`, immediately after the `isActive` export (~line 110):

```ts
/**
 * True once every run in the group has settled (none pending/running). Single source
 * of truth for when comparative verdicts (winner badges, "best" coloring) become
 * authoritative — until then the UI shows progress, not conclusions.
 */
export const runsComplete = (runs: TestRunDto[]): boolean =>
  runs.length > 0 && !runs.some(r => isActive(r.status));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/features/runs/results.spec.ts -t runsComplete`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/runs/results.ts frontend/src/features/runs/results.spec.ts
git commit -m "Add runsComplete helper for run-group settle state"
```

---

## Task 2: `runGroupProgress` helper

Powers the live progress bar (Task 8): monotonic done/total across all runs, percent, and a rough ETA.

**Files:**
- Modify: `frontend/src/features/runs/results.ts` (add after `runsComplete`)
- Test: `frontend/src/features/runs/results.spec.ts`

- [ ] **Step 1: Write the failing test**

Add `runGroupProgress` to the `./results` import list in `results.spec.ts`, then add:

```ts
describe('runGroupProgress', () => {
  const run = (totalCases: number, durations: number[]): TestRunDto => ({
    totalCases,
    results: durations.map((durationMs, i) => ({ testCaseId: `c${i}`, durationMs })),
  } as TestRunDto);

  it('returns zeroed progress with no ETA before anything runs', () => {
    expect(runGroupProgress([run(4, [])])).toEqual({ done: 0, total: 4, percent: 0, etaMs: null });
  });

  it('sums done/total across runs and computes percent', () => {
    const p = runGroupProgress([run(4, [100, 100]), run(4, [100])]);
    expect(p.done).toBe(3);
    expect(p.total).toBe(8);
    expect(p.percent).toBe(38); // round(3/8 * 100)
  });

  it('estimates ETA from average case duration times remaining cases', () => {
    const p = runGroupProgress([run(4, [200, 200])]); // avg 200ms, 2 remaining
    expect(p.etaMs).toBe(400);
  });

  it('has no ETA once everything is done', () => {
    expect(runGroupProgress([run(2, [100, 100])]).etaMs).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/runs/results.spec.ts -t runGroupProgress`
Expected: FAIL — `runGroupProgress is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `results.ts`, after `runsComplete`:

```ts
export interface RunGroupProgress {
  done: number;
  total: number;
  percent: number;
  /** Rough estimate of remaining time, or `null` before any case finishes / when done. */
  etaMs: number | null;
}

/**
 * Aggregate live progress across every run in a group: finished vs total cases, percent,
 * and a coarse ETA (mean finished-case duration × remaining cases). Counts are monotonic
 * because finished results are only ever upserted, never removed.
 */
export function runGroupProgress(runs: TestRunDto[]): RunGroupProgress {
  const total = runs.reduce((s, r) => s + r.totalCases, 0);
  const done = runs.reduce((s, r) => s + r.results.length, 0);
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const durations = runs.flatMap(r => r.results.map(res => res.durationMs));
  const avg = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
  const remaining = total - done;
  const etaMs = avg !== null && remaining > 0 ? Math.round(avg * remaining) : null;
  return { done, total, percent, etaMs };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/features/runs/results.spec.ts -t runGroupProgress`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/runs/results.ts frontend/src/features/runs/results.spec.ts
git commit -m "Add runGroupProgress helper for live progress bar"
```

---

## Task 3: Pending cells carry an evaluator-slot count

So a not-yet-started cell can render grey placeholder dots (Task 5) instead of a bare `—`.

**Files:**
- Modify: `frontend/src/features/runs/results.ts:225` (the pending branch of `buildMatrixCell`)
- Test: `frontend/src/features/runs/results.spec.ts`

- [ ] **Step 1: Write the failing test**

In `results.spec.ts`, inside `describe('buildMatrixRows', ...)`, the local `run` factory (line 190) does not set `evaluators`. Update it to accept an evaluator count, then assert the pending cell's progress. Replace the existing `run` factory in that block with:

```ts
  function run(id: string, results: TestResultDto[], testCases: { id: string; summary: string }[] = [], evaluatorCount = 0): TestRunDto {
    return { id, endpointName: id, results, testCases, evaluators: new Array(evaluatorCount).fill({ id: 'ev', kind: EvaluatorKind.ExactMatch, name: 'E' }) } as TestRunDto;
  }
```

Then add this test to the same block:

```ts
  it('gives pending cells a zero-of-N evaluator slot count', () => {
    const cases = [{ id: 'a', summary: 'A' }];
    const r = run('m1', [], cases, 3); // 3 evaluators, no results yet
    const cell = buildMatrixRows([r])[0].cells[0];
    expect(cell.status).toBe('pending');
    expect(cell.progress).toEqual({ done: 0, total: 3 });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/runs/results.spec.ts -t "evaluator slot count"`
Expected: FAIL — `cell.progress` is `null`.

- [ ] **Step 3: Write minimal implementation**

In `results.ts`, replace the final `return` of `buildMatrixCell` (line 225, the pending branch):

```ts
  return {
    run, result: null, idx: -1, pass: null, score: null,
    status: 'pending', liveEvaluations: [],
    progress: { done: 0, total: run.evaluators?.length ?? 0 },
  };
```

(`?.`/`?? 0` guards the partial test factories that omit `evaluators`; the real DTO always provides the array.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/features/runs/results.spec.ts`
Expected: PASS (whole file green — the existing pending-cell test at line 209 still passes since it only checks `result`/`pass`).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/runs/results.ts frontend/src/features/runs/results.spec.ts
git commit -m "Carry evaluator slot count on pending matrix cells"
```

---

## Task 4: Suppress leaderboard winners until the group settles

The biggest flicker source: winner badges (Best/Fast/Cheap), accent coloring, and `deltaVsBest` recompute every frame and flip between models on partial data. Gate them behind a required `complete` flag.

**Files:**
- Modify: `frontend/src/features/runs/comparison.ts:77-107` (`buildLeaderboard`)
- Modify: `frontend/src/features/runs/components/ModelLeaderboard.tsx:7` (call site — keep build green until Task 7 renames it)
- Test: `frontend/src/features/runs/results.spec.ts`

- [ ] **Step 1: Update existing tests + add suppression tests**

In `results.spec.ts`, the `describe('buildLeaderboard', ...)` block calls `buildLeaderboard(...)` three times without a second arg. Update those three calls to pass `true` (they assert winner selection, which now requires the group be complete):
- Line ~231: `const [ea, eb] = buildLeaderboard([a, b], true);`
- Line ~242: `const [e] = buildLeaderboard([r], true);`
- Line ~250: `const entries = buildLeaderboard([done, running], true);`

Then add a new test to the same block:

```ts
  it('reports no winners and null deltas while the group is not yet complete', () => {
    const a = lbRun({ id: 'a', endpointName: 'a', passedCases: 9, failedCases: 1, durationMs: 1000, costUsd: 0.1 });
    const b = lbRun({ id: 'b', endpointName: 'b', passedCases: 6, failedCases: 4, durationMs: 3000, costUsd: 0.9 });
    const entries = buildLeaderboard([a, b], false);
    expect(entries.every(e => !e.isBest && !e.isFastest && !e.isCheapest)).toBe(true);
    expect(entries.every(e => e.deltaVsBest === null)).toBe(true);
    // non-winner data still present
    expect(entries.find(e => e.run.id === 'a')?.passRate).toBe(90);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/runs/results.spec.ts -t buildLeaderboard`
Expected: FAIL — `buildLeaderboard` ignores the second arg, so the new test sees `isBest === true`.

- [ ] **Step 3: Implement the gate**

In `comparison.ts`, change the signature and winner-pool selection. Replace lines 77-96 (`export function buildLeaderboard(runs: TestRunDto[]): ...` down through the `cheapest` pick) with:

```ts
export function buildLeaderboard(runs: TestRunDto[], complete: boolean): LeaderboardEntry[] {
  const base = runs.map(run => ({
    run,
    passed: run.passedCases,
    failed: run.failedCases,
    pending: Math.max(0, run.totalCases - run.results.length),
    passRate: passRatePercent(run.passedCases, run.passedCases + run.failedCases),
    durationMs: run.durationMs,
    costUsd: run.costUsd,
    tokensIn: run.tokensIn,
    tokensOut: run.tokensOut,
  }));

  // Winners are computed only once the whole group has settled — otherwise badges flip
  // between models on partial data every SSE frame.
  const pool = complete ? base.filter(e => e.run.status === TestRunStatus.Completed && e.passRate !== null) : [];
  const pick = <T>(items: T[], better: (a: T, b: T) => boolean): T | null =>
    items.reduce<T | null>((best, x) => (best === null || better(x, best) ? x : best), null);

  const best = pick(pool, (a, b) => (a.passRate as number) > (b.passRate as number));
  const fastest = pick(pool.filter(e => e.durationMs !== null), (a, b) => (a.durationMs as number) < (b.durationMs as number));
  const cheapest = pick(pool.filter(e => e.costUsd !== null), (a, b) => (a.costUsd as number) < (b.costUsd as number));
```

The trailing `return base.map(...)` block (lines 98-107) is unchanged — `best`/`fastest`/`cheapest` are `null` when `pool` is empty, so all flags are `false` and `deltaVsBest` is `null`.

- [ ] **Step 4: Keep the current call site compiling**

In `ModelLeaderboard.tsx`, add `runsComplete` to the imports and pass it. Replace line 2 and line 7:

```ts
import { buildLeaderboard } from '../comparison';
import { runsComplete } from '../results';
```
```ts
  const entries = buildLeaderboard(runs, runsComplete(runs));
```

- [ ] **Step 5: Run tests + typecheck**

Run: `cd frontend && npx vitest run src/features/runs/results.spec.ts && npm run build`
Expected: PASS (all leaderboard tests green) and build succeeds with no type errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/runs/comparison.ts frontend/src/features/runs/results.spec.ts frontend/src/features/runs/components/ModelLeaderboard.tsx
git commit -m "Suppress leaderboard winners until run group settles"
```

---

## Task 5: `EvalSlots` component + wire into MatrixCell

Replace `EvalDots` with `EvalSlots`, which always renders `total` dots — filled (pass/fail/error) for arrived evaluations, grey for the rest. Running and pending cells now show slots instead of nothing.

**Files:**
- Create: `frontend/src/features/runs/components/EvalSlots.tsx`
- Modify: `frontend/src/features/runs/components/MatrixCell.tsx`

- [ ] **Step 1: Create `EvalSlots.tsx`**

```tsx
import type { EvaluationResultDto } from '../../../api/models';
import { isErrored, isEvalPass } from '../results';
import { cn } from '../../../lib/cn';

/**
 * One dot per evaluator. Arrived evaluations are colored by verdict (pass/fail/error);
 * the remaining `total − arrived` slots render as muted placeholders so a cell shows its
 * evaluator count from the moment it starts — progress fills left→right as events stream in.
 */
export function EvalSlots({ arrived, total }: { arrived: EvaluationResultDto[]; total: number }) {
  const emptyCount = Math.max(0, total - arrived.length);
  return (
    <span className="flex items-center gap-1" data-testid="eval-slots">
      {arrived.map((e, i) => (
        <span
          key={`f${i}`}
          title={`${e.evaluatorName}: ${isErrored(e) ? 'error' : isEvalPass(e) ? 'pass' : 'fail'}`}
          className={cn('w-2 h-2 rounded-full shrink-0', isErrored(e) ? 'bg-warn' : isEvalPass(e) ? 'bg-success' : 'bg-danger')}
        />
      ))}
      {Array.from({ length: emptyCount }).map((_, i) => (
        <span
          key={`e${i}`}
          aria-hidden
          data-testid="eval-slot-empty"
          className="w-2 h-2 rounded-full shrink-0 bg-[var(--text-muted)] opacity-30"
        />
      ))}
    </span>
  );
}
```

- [ ] **Step 2: Rewrite `MatrixCell.tsx` to use `EvalSlots` in all three branches**

Replace the entire file with (note: `EvalDots` is removed; done branch passes the full evaluations as both arrived and total, running uses live + slot total, pending shows all-grey):

```tsx
import type { MatrixCell } from '../results';
import { cn } from '../../../lib/cn';
import { fmtDuration } from '../../../lib/format';
import { FOCUS_RING } from '../../../lib/constants';
import { CheckIcon, XIcon } from '../../../components/icons';
import { RowButton } from '../../../components/ui/RowButton';
import { EvalSlots } from './EvalSlots';

/** Renders one (case × model) cell by lifecycle: finished verdict, live progress, or pending. */
export function MatrixCellContent({ cell, onCompare }: {
  cell: MatrixCell;
  onCompare: (runId: string) => void;
}) {
  if (cell.status === 'done' && cell.result) {
    const verdict = cell.pass === true ? 'pass' : cell.pass === false ? 'fail' : 'no verdict';
    return (
      <RowButton
        onClick={() => onCompare(cell.run.id)}
        title={`${cell.run.endpointName}: ${verdict} — click to compare`}
        className={cn('px-3 py-2.5 flex items-center gap-2 hover:bg-card-2 transition-colors duration-[var(--motion-fast)]', FOCUS_RING)}
      >
        {cell.pass === true ? <CheckIcon size={12} strokeWidth={2.5} className="text-success shrink-0" />
          : cell.pass === false ? <XIcon size={12} strokeWidth={2.5} className="text-danger shrink-0" /> : null}
        <EvalSlots arrived={cell.result.evaluations} total={cell.result.evaluations.length} />
        <span className="mono text-caption text-muted shrink-0">{fmtDuration(cell.result.durationMs)}</span>
      </RowButton>
    );
  }

  if (cell.status === 'running') {
    return (
      <span
        data-testid={`matrix-cell-running-${cell.run.id}`}
        title={`${cell.run.endpointName}: evaluating…`}
        className="w-full px-3 py-2.5 flex items-center gap-2 text-muted"
      >
        <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-accent inline-block shrink-0" />
        <EvalSlots arrived={cell.liveEvaluations} total={cell.progress?.total ?? cell.liveEvaluations.length} />
        {cell.progress && cell.progress.total > 0 && (
          <span className="mono text-caption text-muted shrink-0">{cell.progress.done}/{cell.progress.total}</span>
        )}
      </span>
    );
  }

  // pending: show the evaluator slots greyed out so the cell isn't an empty dash
  return (
    <span
      data-testid={`matrix-cell-pending-${cell.run.id}`}
      title={`${cell.run.endpointName}: queued`}
      className="w-full px-3 py-2.5 flex items-center gap-2 text-muted"
    >
      {cell.progress && cell.progress.total > 0
        ? <EvalSlots arrived={[]} total={cell.progress.total} />
        : <span>—</span>}
    </span>
  );
}
```

- [ ] **Step 3: Verify nothing else imports the removed `EvalDots`**

Run: `cd frontend && grep -rn "EvalDots" src/`
Expected: no matches (the only references were in `MatrixCell.tsx`). If any remain, switch them to `EvalSlots` passing `arrived={evals} total={evals.length}`.

- [ ] **Step 4: Typecheck + lint**

Run: `cd frontend && npm run build && npm run lint`
Expected: build + lint clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/runs/components/EvalSlots.tsx frontend/src/features/runs/components/MatrixCell.tsx
git commit -m "Render evaluator slots in running and pending matrix cells"
```

---

## Task 6: Rename `ModelLeaderboardCard` → `ModelSummaryCard`

Pure rename — the card already renders correctly for a single model (its `multi`-gated badges simply don't show), and winner suppression is handled in `buildLeaderboard` (Task 4). No behavior change here.

**Files:**
- Rename: `frontend/src/features/runs/components/ModelLeaderboardCard.tsx` → `ModelSummaryCard.tsx`
- Modify: the renamed file (component name) and its importer `ModelLeaderboard.tsx`

- [ ] **Step 1: Rename the file**

```bash
cd frontend && git mv src/features/runs/components/ModelLeaderboardCard.tsx src/features/runs/components/ModelSummaryCard.tsx
```

- [ ] **Step 2: Rename the component**

In `ModelSummaryCard.tsx`, rename the exported function. Replace line 12:

```tsx
export function ModelSummaryCard({ entry, multi }: { entry: LeaderboardEntry; multi: boolean }) {
```

(Internal helpers `WinnerBadge`/`MiniStat`/`WINNER_TONE` are unchanged.)

- [ ] **Step 3: Update the importer**

In `ModelLeaderboard.tsx`, replace line 3 and the usage on line 15:

```tsx
import { ModelSummaryCard } from './ModelSummaryCard';
```
```tsx
          <ModelSummaryCard entry={entry} multi={multi} />
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npm run build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add -A frontend/src/features/runs/components/
git commit -m "Rename ModelLeaderboardCard to ModelSummaryCard"
```

---

## Task 7: Rename `ModelLeaderboard` → `PerformanceSummary`, always rendered

The container computes `complete` once and feeds it to `buildLeaderboard`. The component itself is unchanged in markup; only the name and the call site change. It will be rendered unconditionally in Task 10.

**Files:**
- Rename: `frontend/src/features/runs/components/ModelLeaderboard.tsx` → `PerformanceSummary.tsx`
- Modify: the renamed file

- [ ] **Step 1: Rename the file**

```bash
cd frontend && git mv src/features/runs/components/ModelLeaderboard.tsx src/features/runs/components/PerformanceSummary.tsx
```

- [ ] **Step 2: Rename the component, keep the e2e testids**

Replace the contents of `PerformanceSummary.tsx` with (testids `model-leaderboard` / `model-leaderboard-entry-*` are intentionally preserved for `e2e/tests/test-run.spec.ts`):

```tsx
import type { TestRunDto } from '../../../api/models';
import { buildLeaderboard } from '../comparison';
import { runsComplete } from '../results';
import { ModelSummaryCard } from './ModelSummaryCard';

/**
 * Per-model performance summary shown above the matrix for every run group — a grid of one
 * card per model (a single-model group is just the N-of-1 case). Winner badges and comparative
 * coloring only appear once the whole group has settled (see {@link buildLeaderboard}).
 */
export function PerformanceSummary({ runs }: { runs: TestRunDto[] }) {
  const complete = runsComplete(runs);
  const entries = buildLeaderboard(runs, complete);
  const multi = runs.length > 1;
  if (entries.length === 0) return null;

  return (
    <div data-testid="model-leaderboard" className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
      {entries.map(entry => (
        <div key={entry.run.id} data-testid={`model-leaderboard-entry-${entry.run.endpointId}`}>
          <ModelSummaryCard entry={entry} multi={multi} />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck (will fail at GroupDetail import — expected, fixed in Task 10)**

Run: `cd frontend && npm run build`
Expected: FAIL — `GroupDetail.tsx` still imports `./components/ModelLeaderboard`. This is fixed in Task 10. To keep this task independently green, do Step 4 first.

- [ ] **Step 4: Point GroupDetail at the new module name (minimal, keeps build green)**

In `GroupDetail.tsx`, replace line 6 and line 32:

```tsx
import { PerformanceSummary } from './components/PerformanceSummary';
```
```tsx
      {multipleRuns && <PerformanceSummary runs={group.runs} />}
```

(The `multipleRuns` gate is removed in Task 10; this keeps the rename self-contained and compiling.)

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npm run build`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add -A frontend/src/features/runs/
git commit -m "Rename ModelLeaderboard to PerformanceSummary"
```

---

## Task 8: `RunProgressBar` component

Live determinate bar in the header during active runs: `X/Y cases · Z% · ~ETA`.

**Files:**
- Create: `frontend/src/features/runs/components/RunProgressBar.tsx`

- [ ] **Step 1: Check the existing ProgressBar primitive's props**

Run: `cd frontend && sed -n '1,40p' src/components/ui/ProgressBar.tsx`
Expected: note its prop names (e.g. `value`/`max` or `percent`). Use it if it fits; the implementation below assumes a `percent` (0–100) prop. If the real prop differs, adapt the one line that renders it.

- [ ] **Step 2: Create `RunProgressBar.tsx`**

```tsx
import type { TestRunDto } from '../../api/models';
import { runGroupProgress } from '../results';
import { fmtDuration } from '../../../lib/format';
import { ProgressBar } from '../../../components/ui/ProgressBar';

/**
 * Live run progress for an active group: a determinate bar plus "done/total · percent · ~ETA".
 * Counts are monotonic (results only upsert), so the bar never jumps backwards.
 */
export function RunProgressBar({ runs }: { runs: TestRunDto[] }) {
  const { done, total, percent, etaMs } = runGroupProgress(runs);
  return (
    <div className="flex items-center gap-2.5 min-w-0" data-testid="run-progress-bar">
      <div className="flex-1 min-w-[120px] max-w-[280px]">
        <ProgressBar percent={percent} />
      </div>
      <span className="mono text-caption text-muted shrink-0">{done}/{total} · {percent}%</span>
      {etaMs !== null && (
        <span className="mono text-caption text-muted shrink-0">~{fmtDuration(etaMs)} left</span>
      )}
    </div>
  );
}
```

Note the import path for `runGroupProgress`: from `components/` it is `../results` (one level up). `ProgressBar`, `fmtDuration` are two levels up (`../../../`).

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npm run build`
Expected: clean. If `ProgressBar` uses a different prop than `percent`, fix the single `<ProgressBar .../>` line per Step 1's finding.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/runs/components/RunProgressBar.tsx
git commit -m "Add RunProgressBar for live run-group progress"
```

---

## Task 9: Unify `RunGroupHeader` — drop inline stats, host the progress bar

Remove the single-model-only `SingleRunStats` (per-model numbers now live in `PerformanceSummary` for both cases). Show one unified meta line (`id · relative · N model(s)`) and the `RunProgressBar` while active.

**Files:**
- Modify: `frontend/src/features/runs/components/RunGroupHeader.tsx`

- [ ] **Step 1: Replace the meta block and remove `SingleRunStats`**

In `RunGroupHeader.tsx`:

1. Update imports — drop the now-unused helpers and add the progress bar. Replace line 8:

```tsx
import { isActive, runStatusColor } from '../results';
```

2. Add below the existing icon/ui imports (after line 7):

```tsx
import { RunProgressBar } from './RunProgressBar';
import { fmtRelative } from '../../../lib/format';
```

(Keep the existing `agentColor` import on line 2; remove `fmtDuration`/`passRateColor`/`passRatePercent`/`avgLatency` if they were only used by `SingleRunStats`.)

3. Replace the `singleRun` ternary block (lines 48-59) with a unified meta line plus the progress bar:

```tsx
        <div className="flex items-center gap-2 text-body-sm text-muted flex-wrap">
          <span className="mono">{group.id.slice(0, 8)}</span>
          <span>·</span>
          <span>{fmtRelative(group.createdAt)}</span>
          <span>·</span>
          <span>{group.runs.length === 1 ? '1 model' : `${group.runs.length} models`}</span>
        </div>

        {active && (
          <div className="mt-1.5">
            <RunProgressBar runs={group.runs} />
          </div>
        )}
```

4. Delete the entire `function SingleRunStats(...) {...}` (lines 80-113) and the `singleRun` constant (line 25).

- [ ] **Step 2: Verify no dangling references**

Run: `cd frontend && grep -n "SingleRunStats\|singleRun" src/features/runs/components/RunGroupHeader.tsx`
Expected: no matches.

- [ ] **Step 3: Typecheck + lint (lint catches unused imports)**

Run: `cd frontend && npm run build && npm run lint`
Expected: clean. Remove any import the linter flags as unused.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/runs/components/RunGroupHeader.tsx
git commit -m "Unify run header: drop inline single-model stats, add live progress bar"
```

---

## Task 10: Always render `PerformanceSummary` in `GroupDetail`

Remove the `multipleRuns` gate so single-model groups get the summary card too.

**Files:**
- Modify: `frontend/src/features/runs/GroupDetail.tsx`

- [ ] **Step 1: Drop the gate**

In `GroupDetail.tsx`, delete the `multipleRuns` constant (line 18) and replace line 32:

```tsx
      <PerformanceSummary runs={group.runs} />
```

- [ ] **Step 2: Verify no dangling references**

Run: `cd frontend && grep -n "multipleRuns" src/features/runs/GroupDetail.tsx`
Expected: no matches.

- [ ] **Step 3: Typecheck + lint**

Run: `cd frontend && npm run build && npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/runs/GroupDetail.tsx
git commit -m "Always render per-model performance summary"
```

---

## Task 11: Mute the matrix footer pass-rate while active

While a run is in flight the footer pass-rate shouldn't be dressed as a final verdict (alarming color jumps on partial data). Render it muted until settled.

**Files:**
- Modify: `frontend/src/features/runs/MatrixView.tsx:137-146` (footer per-model pass rate)

- [ ] **Step 1: Mute the footer pass-rate color while `active`**

In `MatrixView.tsx`, the footer maps each run to a pass-rate figure (lines 137-146). `active` is already computed at line 27. Change the pass-rate `<span>` color so it's muted during the run. Replace the `style={{ color: passRateColor(pr) }}` on line 142 with:

```tsx
                  <span className="mono text-title font-bold" style={{ color: active ? 'var(--text-muted)' : passRateColor(pr) }}>{pr !== null ? `${pr}%` : '—'}</span>
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npm run build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/runs/MatrixView.tsx
git commit -m "Mute matrix footer pass-rate while run is active"
```

---

## Task 12: Update the user manual

Document the reworked run experience: live progress bar, evaluator slots filling in real time, unified per-model summary, and "verdicts finalize when the run completes."

**Files:**
- Modify: the runs page under `manual/guide/` (find it first)

- [ ] **Step 1: Locate the runs page**

Run: `cd /Users/eberharter/Proxytrace && ls manual/guide && grep -rln "test run\|run group\|leaderboard\|matrix" manual/guide`
Expected: identifies the page describing test runs (e.g. `manual/guide/runs.md` or similar).

- [ ] **Step 2: Update the prose**

In that page, ensure the "viewing a run" section states:
- A **live progress bar** in the header shows `done/total · % · ETA` while a run is active.
- Each matrix cell shows one **evaluator slot per evaluator** — grey while queued, filling green/red/amber (pass/fail/error) as each evaluator finishes, so progress is visible in real time.
- A **per-model performance summary** is shown for every run (single- or multi-model); **Best / Fast / Cheap** badges and comparative coloring appear only once the whole run group has finished.
- Click any cell to open the **comparison drawer** with the case input, model output, and per-evaluator verdicts.

Match the existing page's heading style and tone; do not invent screenshots.

- [ ] **Step 3: Verify the manual builds**

Run: `cd /Users/eberharter/Proxytrace/manual && npm run docs:build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add manual/
git commit -m "Document reworked test-run UI in the manual"
```

---

## Task 13: Full verification

- [ ] **Step 1: Full frontend test + build + lint**

Run: `cd frontend && npm test && npm run build && npm run lint`
Expected: all unit tests pass, build clean, lint clean.

- [ ] **Step 2: e2e testid sanity (no Docker run required — static check)**

Run: `cd /Users/eberharter/Proxytrace && grep -rn "model-leaderboard\|matrix-cell-running" e2e/tests/test-run.spec.ts`
Expected: the referenced testids (`model-leaderboard`, `model-leaderboard-entry-*`) still exist in the new `PerformanceSummary.tsx`, and `matrix-cell-running-*` still exists in `MatrixCell.tsx`. Confirm by:
`grep -rn "model-leaderboard\|matrix-cell-running" frontend/src/features/runs/`

- [ ] **Step 3: Manual smoke (if a dev stack is handy)**

Start `./dev.sh`, open a run while it executes, and confirm: the progress bar advances, evaluator slots fill live (grey → colored), no rows reshuffle, no winner badges until the run completes, and a single-model run shows a summary card. (If no stack is available, note this step was skipped.)

- [ ] **Step 4: Run the `review` skill**

Per `CLAUDE.md`, do a critical review of the full diff with the `review` skill before considering the work done.

- [ ] **Step 5: Final commit if review surfaces fixes**

Apply any review fixes, re-run Step 1, and commit.

---

## Self-Review Notes

- **Spec coverage:** stable scaffold (Task 3 pending slots + existing frozen order), evaluator slots (Tasks 3+5), unified single/multi summary (Tasks 6+7+10), verdict suppression (Task 4 winners + Task 11 footer), live progress bar (Tasks 2+8+9), drawer kept (untouched), docs (Task 12), tests (Tasks 1-4). All spec sections map to a task.
- **No backend tasks** — confirmed correct in the spec; out of scope.
- **Type consistency:** `runsComplete(runs)`, `runGroupProgress(runs)→RunGroupProgress`, `buildLeaderboard(runs, complete)`, `EvalSlots({arrived,total})`, `RunProgressBar({runs})`, `PerformanceSummary({runs})`, `ModelSummaryCard({entry,multi})` — names used consistently across tasks.
- **e2e testids preserved:** `model-leaderboard*` (Task 7), `matrix-cell-running-*` (Task 5).
- **Each task compiles independently:** call sites are updated in the same task that changes a signature/name (Tasks 4, 6, 7).
