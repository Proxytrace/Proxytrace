import { TestRunStatus } from '../../../../api/models';
import type { AnyAwaitResult, AwaitError, RunAwaitResult } from '../../tools/await';

/** Overall verdict of a finished wait, driving the card's summary badge. */
export type AwaitOutcomeTone = 'success' | 'warn' | 'danger';

/**
 * Collapses a resolved `await_actions` aggregate into one card-level verdict: a failed run or an
 * unreadable handle is a problem (danger); anything still running past the cap or cancelled
 * before finishing is a heads-up (warn) — its results are missing or incomplete, so "all done"
 * would mislead. A rejected theory is a normal outcome, not a failure — the A/B test did its job.
 */
export function awaitOutcome(
  results: AnyAwaitResult[],
  errors: AwaitError[] | undefined,
  anyTimedOut: boolean,
): AwaitOutcomeTone {
  const anyFailed = results.some((r) => r.kind === 'test-run' && !r.timedOut && r.status === TestRunStatus.Failed);
  if (anyFailed || (errors?.length ?? 0) > 0) return 'danger';
  const anyCancelled = results.some(
    (r) => r.kind === 'test-run' && !r.timedOut && r.status === TestRunStatus.Cancelled,
  );
  if (anyTimedOut || anyCancelled) return 'warn';
  return 'success';
}

/**
 * "Suite → Agent" (or whatever name parts exist) for an awaited entity, or `null` when none are
 * present so the caller can fall back to a localized kind label. Older conversation snapshots in
 * localStorage predate the enriched result shape, so the names must be treated as optional even
 * though the current tool always sets them.
 */
export function entityLabel(item: { suiteName?: string; agentName?: string }): string | null {
  const parts = [item.suiteName, item.agentName].filter(Boolean);
  return parts.length > 0 ? parts.join(' → ') : null;
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
