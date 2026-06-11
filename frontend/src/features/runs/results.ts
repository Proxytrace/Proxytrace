// Pure derive/format helpers for the test-runs UI. No JSX, no I/O — unit-tested
// in results.spec.ts. Both the run list and the fixture drawers consume these so
// that a case's pass verdict and score are computed identically everywhere.

import { TestRunStatus, EvaluationScore } from '../../api/models';
import type {
  EvaluationResultDto,
  RunCompleteEvent,
  TestCaseFixtureDto,
  TestResultArrivedEvent,
  TestResultDto,
  TestRunDto,
  TestRunGroupDto,
} from '../../api/models';
import { PASS_RATE_WARN, PASS_RATE_DANGER, SCORE_WARN, SCORE_DANGER } from '../../lib/constants';
import { liveCaseFor, type LiveProgress } from './live';

const SUCCESS = 'var(--success)';
const WARN = 'var(--warn)';
const DANGER = 'var(--danger)';
const MUTED = 'var(--text-muted)';
const ACCENT = 'var(--accent-primary)';

const PASSING_SCORES = new Set<EvaluationScore>([
  EvaluationScore.Acceptable,
  EvaluationScore.Good,
  EvaluationScore.Excellent,
]);

// ── Evaluator-level ──────────────────────────────────────────────────────────

export const isErrored = (e: EvaluationResultDto): boolean => e.errorMessage !== null;

export const isEvalPass = (e: EvaluationResultDto): boolean =>
  !isErrored(e) && e.score !== null && PASSING_SCORES.has(e.score);

/** Maps a backend evaluation score (1..5) to its label, e.g. 5 → "Excellent". */
const SCORE_LABEL_BY_VALUE: Record<number, EvaluationScore> = {
  1: EvaluationScore.Terrible,
  2: EvaluationScore.Bad,
  3: EvaluationScore.Acceptable,
  4: EvaluationScore.Good,
  5: EvaluationScore.Excellent,
};

/**
 * Human label for an evaluator score. The backend serializes the {@link EvaluationScore}
 * enum as its underlying byte (1..5), so the value is an ordinal — not a 0..1 fraction.
 * Returns the score word ("Excellent"), the raw number for unexpected values, or "—" for null.
 */
export function scoreLabel(score: number | null): string {
  if (score === null) return '—';
  return SCORE_LABEL_BY_VALUE[score] ?? String(score);
}

// ── Case-level ───────────────────────────────────────────────────────────────

/** A case passes only if every evaluator passes. `null` when it has no evaluators yet. */
export function resultPass(r: TestResultDto): boolean | null {
  if (r.evaluations.length === 0) return null;
  return r.evaluations.every(isEvalPass);
}

/**
 * Case score = fraction of evaluators that passed (0..1). Errored evaluators count
 * as non-pass, matching the fixture drawer's composite. `null` when no evaluators.
 */
export function resultScore(r: TestResultDto): number | null {
  if (r.evaluations.length === 0) return null;
  return r.evaluations.filter(isEvalPass).length / r.evaluations.length;
}

/** Composite percent (0..100) from passed/total evaluators; `null` when total is 0. */
export function compositePercent(passed: number, total: number): number | null {
  return total > 0 ? Math.round((passed / total) * 100) : null;
}

/** Pass rate percent (0..100) from passed/total cases; `null` when total is 0. Same math as {@link compositePercent}. */
export const passRatePercent = compositePercent;

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
  const totalCost = fixture?.endpoints.reduce((s, ep) => s + ep.costUsd, 0) ?? 0;
  const totalTokens = fixture?.endpoints.reduce((s, ep) => s + ep.tokIn + ep.tokOut, 0) ?? 0;
  const tokensOut = fixture?.endpoints.reduce((s, ep) => s + ep.tokOut, 0) ?? 0;
  return { passed, total, allPass: total > 0 && passed === total, composite: compositePercent(passed, total), totalCost, totalTokens, tokensOut };
}

export function avgLatency(run: TestRunDto): number | null {
  if (run.results.length === 0) return null;
  return run.results.reduce((s, r) => s + r.durationMs, 0) / run.results.length;
}

// ── Run status ───────────────────────────────────────────────────────────────

export const isActive = (s: TestRunStatus): boolean =>
  s === TestRunStatus.Running || s === TestRunStatus.Pending;

/**
 * True once every run in the group has settled (none pending/running). Single source
 * of truth for when comparative verdicts (winner badges, "best" coloring) become
 * authoritative — until then the UI shows progress, not conclusions.
 */
export const runsComplete = (runs: TestRunDto[]): boolean =>
  runs.length > 0 && !runs.some(r => isActive(r.status));

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

export function runStatusColor(s: TestRunStatus): string {
  if (s === TestRunStatus.Completed) return SUCCESS;
  if (s === TestRunStatus.Running) return ACCENT;
  if (s === TestRunStatus.Failed) return DANGER;
  return MUTED;
}

// ── Color mappers (single source of truth for thresholds) ────────────────────

/** Color for a pass rate on the 0..100 scale (PASS_RATE_WARN / PASS_RATE_DANGER). */
export function passRateColor(rate: number | null): string {
  if (rate === null) return MUTED;
  return rate >= PASS_RATE_WARN ? SUCCESS : rate >= PASS_RATE_DANGER ? WARN : DANGER;
}

/** Color for a score on the 0..1 scale (SCORE_WARN / SCORE_DANGER). */
export function scoreColor(score: number | null): string {
  if (score === null) return MUTED;
  return score >= SCORE_WARN ? SUCCESS : score >= SCORE_DANGER ? WARN : DANGER;
}

/** Color for a composite percent on the 0..100 scale, using the score thresholds. */
export const compositeColor = (percent: number | null): string =>
  scoreColor(percent === null ? null : percent / 100);

export function dotColor(pass: boolean | null): string {
  return pass === true ? SUCCESS : pass === false ? DANGER : MUTED;
}

// ── Divergence (model comparison) ────────────────────────────────────────────

/** True when a set of pass states contains both a pass and a fail. */
export const isDivergent = (states: boolean[]): boolean =>
  states.includes(true) && states.includes(false);

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
function buildMatrixCell(run: TestRunDto, caseId: string, live?: LiveProgress): MatrixCell {
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
    };
    const results = [...run.results.filter(r => r.testCaseId !== e.testCaseId), result];
    return withCounts(run, results);
  });
}

/** Flips a single run's status/completion in the selected group on a `run-complete` event. */
export function patchGroupRunStatus(
  group: TestRunGroupDto,
  e: RunCompleteEvent,
): TestRunGroupDto {
  if (group.id !== e.groupId) return group;
  return mapRun(group, e.runId, run => ({ ...run, status: e.status, completedAt: e.completedAt }));
}

/** Recomputes pass/fail counts and (judged-denominator) pass rate from a run's results. */
function withCounts(run: TestRunDto, results: TestResultDto[]): TestRunDto {
  const passedCases = results.filter(r => resultPass(r) === true).length;
  const failedCases = results.filter(r => resultPass(r) === false).length;
  return { ...run, results, passedCases, failedCases, passRate: compositePercent(passedCases, passedCases + failedCases) ?? 0 };
}

/** Applies `fn` to the one matching run inside the group; everything else is untouched. */
function mapRun(
  group: TestRunGroupDto,
  runId: string,
  fn: (run: TestRunDto) => TestRunDto,
): TestRunGroupDto {
  return { ...group, runs: group.runs.map(run => (run.id === runId ? fn(run) : run)) };
}
