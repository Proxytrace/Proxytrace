import type { AgentPassRatePointDto } from '../../api/models';

/** Token color for a pass-rate percentage (shared across agent widgets). */
export function passRateColor(pct: number): string {
  if (pct >= 80) return 'var(--success)';
  if (pct >= 50) return 'var(--accent-primary)';
  return 'var(--warn)';
}

export interface PassRateSummary {
  /** Overall pass rate 0–100, or null when no completed cases in range. */
  overall: number | null;
  totalPassed: number;
  totalCases: number;
  /** Per-bucket pass-rate percentages, for the trend sparkline. */
  trendValues: number[];
}

/** Aggregate a pass-rate trend into an overall percentage + sparkline series. */
export function summarizePassRate(trend: readonly AgentPassRatePointDto[]): PassRateSummary {
  const totalCases = trend.reduce((s, p) => s + p.testCases, 0);
  const totalPassed = trend.reduce((s, p) => s + p.passed, 0);
  return {
    overall: totalCases > 0 ? (totalPassed / totalCases) * 100 : null,
    totalPassed,
    totalCases,
    trendValues: trend.map(p => (p.testCases > 0 ? (p.passed / p.testCases) * 100 : 0)),
  };
}

/**
 * Change in pass rate across the range, in percentage points (rounded).
 * Compares the first vs last bucket that actually has test cases; null when
 * fewer than two such buckets exist.
 */
export function passRateDelta(trend: readonly AgentPassRatePointDto[]): number | null {
  const withCases = trend.filter(p => p.testCases > 0);
  if (withCases.length < 2) return null;
  const pct = (p: AgentPassRatePointDto) => (p.passed / p.testCases) * 100;
  return Math.round(pct(withCases[withCases.length - 1]) - pct(withCases[0]));
}
