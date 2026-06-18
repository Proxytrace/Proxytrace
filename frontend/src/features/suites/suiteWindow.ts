import { rangeFromOpt } from '../../lib/time-range';

export type SuiteWindowKey = 'last' | '7d' | '30d' | 'all';
export const SUITE_WINDOW_KEYS: readonly SuiteWindowKey[] = ['last', '7d', '30d', 'all'] as const;

export interface SuiteWindow { from: string | undefined; to: string | undefined; }

/**
 * Resolve a bucket key to a [from, to] window for the run-stats query.
 * - `all`  → unbounded.
 * - `7d`/`30d` → lower-bounded only (open to "now"), reusing the dashboard range helper.
 * - `last` → the single most recent run: `[lastRunAt, now]`. When the suite has never run,
 *   `from === to` so the window is empty and the endpoint returns zeroed stats.
 */
export function suiteWindowRange(key: SuiteWindowKey, lastRunAt: string | null): SuiteWindow {
  if (key === 'all') return { from: undefined, to: undefined };
  if (key === '7d') return { from: rangeFromOpt('7d'), to: undefined };
  if (key === '30d') return { from: rangeFromOpt('30d'), to: undefined };
  const now = new Date().toISOString();
  return lastRunAt ? { from: lastRunAt, to: now } : { from: now, to: now };
}

export function suiteWindowLabel(key: SuiteWindowKey): string {
  if (key === 'last') return 'Last run';
  if (key === '7d') return 'Last 7 days';
  if (key === '30d') return 'Last 30 days';
  return 'All time';
}
