// Runs-specific derive/format helpers for the test-runs UI. No JSX, no I/O — unit-tested
// in results.spec.ts. The cross-cutting verdict/score/status/color primitives (resultPass,
// isActive, passRateColor, compositePercent, …) now live in lib/runResults.ts so the Tracey
// assistant can consume them without a cross-feature import; this module re-exports them
// (`export *` below) so existing runs/ consumers keep importing from './results' unchanged.
// What stays here is runs-only aggregation: the (case × model) matrix pivot, SSE cache
// patching, and the fixture/progress rollups.

import { TestRunStatus } from '../../api/models';
import type {
  RunCompleteEvent,
  TestCaseFixtureDto,
  TestResultArrivedEvent,
  TestResultDto,
  TestRunDto,
  TestRunGroupDto,
  EvaluationResultDto,
} from '../../api/models';
import { resultPass, resultScore, compositePercent, isDivergent } from '../../lib/runResults';
import { liveCaseFor, type LiveProgress } from './live';

export * from '../../lib/runResults';

// ── Fixture & latency rollups ─────────────────────────────────────────────────

export interface FixtureSummary {
  passed: number;
  total: number;
  allPass: boolean;
  composite: number | null;
  totalCost: number;
  totalTokens: number;
  tokensOut: number;
}

/** Rolls a single-case fixture up into the metrics both drawers display. Zeroed when the fixture is still loading. */
export function fixtureSummary(fixture: TestCaseFixtureDto | undefined): FixtureSummary {
  const passed = fixture?.evaluators.filter(e => e.pass).length ?? 0;
  const total = fixture?.evaluators.length ?? 0;
  const totalCost = fixture?.endpoints.reduce((s, ep) => s + ep.costEur, 0) ?? 0;
  const totalTokens = fixture?.endpoints.reduce((s, ep) => s + ep.tokIn + ep.tokOut, 0) ?? 0;
  const tokensOut = fixture?.endpoints.reduce((s, ep) => s + ep.tokOut, 0) ?? 0;
  return { passed, total, allPass: total > 0 && passed === total, composite: compositePercent(passed, total), totalCost, totalTokens, tokensOut };
}

export function avgLatency(run: TestRunDto): number | null {
  if (run.results.length === 0) return null;
  return run.results.reduce((s, r) => s + r.durationMs, 0) / run.results.length;
}

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

// ── Model-comparison matrix (pivot) ──────────────────────────────────────────

/**
 * A cell's lifecycle in the (case × model) grid:
 * - `done` — the case finished for this model; `result`/`pass`/`score` are authoritative.
 * - `running` — inference/evaluation is in flight; `liveEvaluations` + `progress` fill in live.
 * - `pending` — not started for this model yet.
 */
export type CellStatus = 'done' | 'running' | 'pending';

export interface MatrixCell {
  run: TestRunDto;
  result: TestResultDto | null;
  pass: boolean | null;
  score: number | null;
  idx: number;
  status: CellStatus;
  /** Evaluations reported so far while `status === 'running'`; empty otherwise. */
  liveEvaluations: EvaluationResultDto[];
  /** Evaluator progress while running: how many of the run's evaluators have reported. */
  progress: { done: number; total: number } | null;
}

export interface MatrixRow {
  caseId: string;
  summary: string;
  cells: MatrixCell[];
  divergent: boolean;
  failCount: number;
}

/**
 * Pivots a group's runs into a (case × model) grid in **stable suite order** (the order cases
 * first appear across the runs). `testCaseId` is shared across runs in a group. `live` (optional)
 * overlays in-flight progress for cases with no finalized result yet, so a running case shows
 * per-evaluator progress instead of a bare placeholder.
 *
 * Ordering is intentionally stable here so rows don't reshuffle on every event while a run is in
 * flight — divergence/worst ordering is applied later by {@link filterSortMatrixRows}, and only
 * once the run has settled (see its `freezeOrder` argument).
 */
export function buildMatrixRows(runs: TestRunDto[], live?: LiveProgress): MatrixRow[] {
  const caseMap = new Map<string, string>();
  runs.forEach(run => {
    run.testCases.forEach(tc => { if (!caseMap.has(tc.id)) caseMap.set(tc.id, tc.summary); });
    run.results.forEach(r => { if (!caseMap.has(r.testCaseId)) caseMap.set(r.testCaseId, r.testCaseSummary); });
  });

  return [...caseMap.entries()].map(([caseId, summary]) => {
    const cells: MatrixCell[] = runs.map(run => buildMatrixCell(run, caseId, live));
    const states = cells.flatMap(c => (c.result && c.pass !== null ? [c.pass] : []));
    return { caseId, summary, cells, divergent: isDivergent(states), failCount: cells.filter(c => c.pass === false).length };
  });
}

/** Builds one (run, case) cell, preferring a finalized result and falling back to live progress. */
export function buildMatrixCell(run: TestRunDto, caseId: string, live?: LiveProgress): MatrixCell {
  const idx = run.results.findIndex(r => r.testCaseId === caseId);
  if (idx >= 0) {
    const result = run.results[idx];
    return {
      run, result, idx,
      pass: resultPass(result),
      score: resultScore(result),
      status: 'done',
      liveEvaluations: [],
      progress: null,
    };
  }
  const liveCase = liveCaseFor(live, run.id, caseId);
  if (liveCase) {
    return {
      run, result: null, idx: -1, pass: null, score: null,
      status: 'running',
      liveEvaluations: liveCase.evaluations,
      progress: { done: liveCase.evaluations.length, total: run.evaluators.length },
    };
  }
  return {
    run, result: null, idx: -1, pass: null, score: null,
    status: 'pending', liveEvaluations: [],
    progress: { done: 0, total: run.evaluators?.length ?? 0 },
  };
}

// ── Live cache patching (SSE) ─────────────────────────────────────────────────

/**
 * Folds a `test-result-arrived` event into the selected (fat) group: upserts the arriving
 * (finalized) result into its run and recomputes that run's pass/fail counts. If the case is
 * already present its result is *replaced* with the authoritative one (a late event must not be
 * silently dropped). Returns the group unchanged when the event is for another group/run, so SSE
 * never triggers a refetch.
 */
export function patchGroupWithResult(
  group: TestRunGroupDto,
  e: TestResultArrivedEvent,
): TestRunGroupDto {
  if (group.id !== e.groupId) return group;
  return mapRun(group, e.runId, run => {
    const result: TestResultDto = {
      id: e.testCaseId,
      testCaseId: e.testCaseId,
      testCaseSummary: run.testCases.find(tc => tc.id === e.testCaseId)?.summary ?? '',
      actualResponse: '',
      evaluations: e.evaluations,
      durationMs: e.durationMs,
      costEur: e.costEur ?? null,
      tokensIn: e.tokensIn ?? null,
      tokensOut: e.tokensOut ?? null,
      cachedTokensIn: e.cachedTokensIn ?? null,
    };
    const results = [...run.results.filter(r => r.testCaseId !== e.testCaseId), result];
    return withCounts(run, results);
  });
}

/** Sums one nullable per-case metric across a run's results; `null` when no case reported it (so a
 * run with no usage reads "—", matching the backend's TestRunTotals, not a misleading 0). */
function sumOrNull(values: (number | null | undefined)[]): number | null {
  const present = values.filter((x): x is number => x != null);
  return present.length > 0 ? present.reduce((a, b) => a + b, 0) : null;
}

/** Flips a single run's status/completion in the selected group on a `run-complete` event. */
export function patchGroupRunStatus(
  group: TestRunGroupDto,
  e: RunCompleteEvent,
): TestRunGroupDto {
  if (group.id !== e.groupId) return group;
  return mapRun(group, e.runId, run => ({ ...run, status: e.status, completedAt: e.completedAt }));
}

/**
 * Flips a still-`Pending` run to `Running` the moment its first event arrives (a case has started).
 * The backend only marks a *run* `Running` once its first case finishes and never streams that
 * transition, so a freshly-opened run otherwise reads `Pending` for its whole duration — leaving the
 * model cards stuck on "pending" with a "—" duration. No-ops (returns the same group reference) once
 * the run is past `Pending`, so applying it on every case-started event stays cheap and render-stable.
 */
export function markRunRunning(group: TestRunGroupDto, runId: string): TestRunGroupDto {
  const run = group.runs.find(r => r.id === runId);
  if (!run || run.status !== TestRunStatus.Pending) return group;
  return mapRun(group, runId, r => ({ ...r, status: TestRunStatus.Running }));
}

/**
 * Recomputes pass/fail counts, (judged-denominator) pass rate, and the run-level cost/token totals
 * from a run's results. The totals are summed from the per-case usage carried on each result so the
 * run cards read live during a run (the backend leaves run-level totals null until the run finishes);
 * the terminal refetch then reconciles to the authoritative backend totals.
 */
function withCounts(run: TestRunDto, results: TestResultDto[]): TestRunDto {
  const passedCases = results.filter(r => resultPass(r) === true).length;
  const failedCases = results.filter(r => resultPass(r) === false).length;
  return {
    ...run,
    results,
    passedCases,
    failedCases,
    passRate: compositePercent(passedCases, passedCases + failedCases) ?? 0,
    costEur: sumOrNull(results.map(r => r.costEur)),
    tokensIn: sumOrNull(results.map(r => r.tokensIn)),
    tokensOut: sumOrNull(results.map(r => r.tokensOut)),
    cachedTokensIn: sumOrNull(results.map(r => r.cachedTokensIn)),
  };
}

/** Applies `fn` to the one matching run inside the group; everything else is untouched. */
function mapRun(
  group: TestRunGroupDto,
  runId: string,
  fn: (run: TestRunDto) => TestRunDto,
): TestRunGroupDto {
  return { ...group, runs: group.runs.map(run => (run.id === runId ? fn(run) : run)) };
}
