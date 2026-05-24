// Pure derive/format helpers for the test-runs UI. No JSX, no I/O — unit-tested
// in results.spec.ts. Both the run list and the fixture drawers consume these so
// that a case's pass verdict and score are computed identically everywhere.

import { TestRunStatus, EvaluationScore } from '../../api/models';
import type { EvaluationResultDto, TestResultDto, TestRunDto } from '../../api/models';
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
