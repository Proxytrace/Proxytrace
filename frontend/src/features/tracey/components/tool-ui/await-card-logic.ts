import { TestRunStatus } from '../../../../api/models';
import type { AnyAwaitResult, AwaitError, RunAwaitResult } from '../../tools/await';

/** Overall verdict of a finished wait, driving the card's summary badge. */
export type AwaitOutcomeTone = 'success' | 'warn' | 'danger';

/**
 * Collapses a resolved `await_actions` aggregate into one card-level verdict: any failed run or
 * unreadable handle is a problem (danger), anything still running past the cap is a heads-up
 * (warn), otherwise everything landed (success). A rejected theory is a normal outcome, not a
 * failure — the A/B test did its job.
 */
export function awaitOutcome(
  results: AnyAwaitResult[],
  errors: AwaitError[] | undefined,
  anyTimedOut: boolean,
): AwaitOutcomeTone {
  const anyFailed = results.some((r) => r.kind === 'test-run' && !r.timedOut && r.status === TestRunStatus.Failed);
  if (anyFailed || (errors?.length ?? 0) > 0) return 'danger';
  if (anyTimedOut) return 'warn';
  return 'success';
}

/** Aggregated case counts across a run result's runs (absent on legacy snapshots). */
export function runCaseSummary(result: RunAwaitResult): { passed: number; failed: number; total: number } | null {
  if (!Array.isArray(result.runs) || result.runs.length === 0) return null;
  return result.runs.reduce(
    (acc, run) => ({
      passed: acc.passed + run.passed,
      failed: acc.failed + run.failed,
      total: acc.total + run.total,
    }),
    { passed: 0, failed: 0, total: 0 },
  );
}

/** Formats elapsed whole seconds as a compact m:ss stopwatch readout. */
export function fmtElapsed(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(s / 60);
  const rest = s % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}
