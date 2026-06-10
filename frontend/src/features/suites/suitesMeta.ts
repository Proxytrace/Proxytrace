import type { TestSuiteListItemDto } from '../../api/models';
import { PASS_RATE_WARN, PASS_RATE_DANGER } from '../../lib/constants';

/** Derive the CSS-variable colour string for a pass-rate value. */
export function passRateColor(passRate: number | null): string {
  if (passRate === null) return 'var(--text-muted)';
  if (passRate >= PASS_RATE_WARN) return 'var(--success)';
  if (passRate >= PASS_RATE_DANGER) return 'var(--warn)';
  return 'var(--danger)';
}

export interface SuiteStats {
  totalCases: number;
  totalRuns: number;
  avgPassRate: number | null;
}

/** Aggregate KPI stats across all suites in the list. */
export function computeSuiteStats(suites: TestSuiteListItemDto[]): SuiteStats {
  const totalCases = suites.reduce((n, s) => n + s.testCaseCount, 0);
  const totalRuns = suites.reduce((n, s) => n + s.totalRuns, 0);
  const withRate = suites.filter(s => s.passRate !== null);
  const avgPassRate =
    withRate.length > 0
      ? Math.round(withRate.reduce((n, s) => n + (s.passRate ?? 0), 0) / withRate.length)
      : null;
  return { totalCases, totalRuns, avgPassRate };
}
