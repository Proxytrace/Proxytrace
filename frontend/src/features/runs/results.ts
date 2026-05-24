// Pure derive/format helpers for the test-runs UI. No JSX, no I/O — unit-tested
// in results.spec.ts. Both the run list and the fixture drawers consume these so
// that a case's pass verdict and score are computed identically everywhere.

import { TestRunStatus, EvaluationScore } from '../../api/models';
import type {
  EvaluationResultDto,
  PagedResult,
  TestCaseFixtureDto,
  TestResultArrivedEvent,
  TestResultDto,
  TestRunDto,
  TestRunGroupDto,
} from '../../api/models';
import { PASS_RATE_WARN, PASS_RATE_DANGER, SCORE_WARN, SCORE_DANGER } from '../../lib/constants';

export type CaseFilter = 'all' | 'passed' | 'failed';
export type ViewMode = 'table' | 'grid';

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
}

/** Rolls a single-case fixture up into the metrics both drawers display. Zeroed when the fixture is still loading. */
export function fixtureSummary(fixture: TestCaseFixtureDto | undefined): FixtureSummary {
  const passed = fixture?.evaluators.filter(e => e.pass).length ?? 0;
  const total = fixture?.evaluators.length ?? 0;
  const totalCost = fixture?.endpoints.reduce((s, ep) => s + ep.costUsd, 0) ?? 0;
  const totalTokens = fixture?.endpoints.reduce((s, ep) => s + ep.tokIn + ep.tokOut, 0) ?? 0;
  return { passed, total, allPass: total > 0 && passed === total, composite: compositePercent(passed, total), totalCost, totalTokens };
}

export function avgLatency(run: TestRunDto): number | null {
  if (run.results.length === 0) return null;
  return run.results.reduce((s, r) => s + r.durationMs, 0) / run.results.length;
}

// ── Run status ───────────────────────────────────────────────────────────────

export const isActive = (s: TestRunStatus): boolean =>
  s === TestRunStatus.Running || s === TestRunStatus.Pending;

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

export interface MatrixCell {
  run: TestRunDto;
  result: TestResultDto | null;
  pass: boolean | null;
  score: number | null;
  idx: number;
}

export interface MatrixRow {
  caseId: string;
  summary: string;
  cells: MatrixCell[];
  divergent: boolean;
  failCount: number;
}

/**
 * Pivots a group's runs into a (case × model) grid. `testCaseId` is shared across
 * runs in a group. Ordered divergence-first, then most failures, then alphabetical.
 */
export function buildMatrixRows(runs: TestRunDto[]): MatrixRow[] {
  const caseMap = new Map<string, string>();
  runs.forEach(run => {
    run.testCases.forEach(tc => { if (!caseMap.has(tc.id)) caseMap.set(tc.id, tc.summary); });
    run.results.forEach(r => { if (!caseMap.has(r.testCaseId)) caseMap.set(r.testCaseId, r.testCaseSummary); });
  });

  const rows: MatrixRow[] = [...caseMap.entries()].map(([caseId, summary]) => {
    const cells: MatrixCell[] = runs.map(run => {
      const idx = run.results.findIndex(r => r.testCaseId === caseId);
      const result = idx >= 0 ? run.results[idx] : null;
      return { run, result, pass: result ? resultPass(result) : null, score: result ? resultScore(result) : null, idx };
    });
    const states = cells.flatMap(c => (c.result && c.pass !== null ? [c.pass] : []));
    return { caseId, summary, cells, divergent: isDivergent(states), failCount: cells.filter(c => c.pass === false).length };
  });

  rows.sort((a, b) => (Number(b.divergent) - Number(a.divergent)) || (b.failCount - a.failCount) || a.summary.localeCompare(b.summary));
  return rows;
}

// ── Live cache patching (SSE) ─────────────────────────────────────────────────

/**
 * Folds a `test-result-arrived` event into a cached group-list page: appends the
 * arriving result to its run and recomputes that run's pass/fail counts. Returns
 * the page unchanged if the group/run is absent or the result is already present
 * (idempotent), so SSE never triggers a refetch.
 */
export function patchGroupsWithResult(
  page: PagedResult<TestRunGroupDto>,
  e: TestResultArrivedEvent,
): PagedResult<TestRunGroupDto> {
  return {
    ...page,
    items: page.items.map(g =>
      g.id !== e.groupId
        ? g
        : {
            ...g,
            runs: g.runs.map(run => {
              if (run.id !== e.runId || run.results.some(r => r.testCaseId === e.testCaseId)) return run;
              const result: TestResultDto = {
                id: e.testCaseId,
                testCaseId: e.testCaseId,
                testCaseSummary: run.testCases.find(tc => tc.id === e.testCaseId)?.summary ?? '',
                actualResponse: '',
                evaluations: e.evaluations,
                durationMs: e.durationMs,
              };
              const results = [...run.results, result];
              const passedCases = results.filter(r => resultPass(r) === true).length;
              const failedCases = results.filter(r => resultPass(r) === false).length;
              return { ...run, results, passedCases, failedCases, passRate: compositePercent(passedCases, run.totalCases) ?? 0 };
            }),
          },
    ),
  };
}
