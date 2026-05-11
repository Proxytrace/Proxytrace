import type { AgentOverviewDto } from '../../../api/models';
import { Sparkline } from '../../../components/charts';
import { Widget } from './Widget';

interface Props {
  overview: AgentOverviewDto;
  className?: string;
}

function color(pct: number): string {
  if (pct >= 80) return 'var(--success)';
  if (pct >= 50) return 'var(--accent-primary)';
  return 'var(--warn)';
}

export function PassRateWidget({ overview, className }: Props) {
  const trend = overview.passRateTrend;
  const totalCases = trend.reduce((s, p) => s + p.testCases, 0);
  const totalPassed = trend.reduce((s, p) => s + p.passed, 0);
  const overall = totalCases > 0 ? (totalPassed / totalCases) * 100 : null;
  const trendValues = trend.map(p => (p.testCases > 0 ? (p.passed / p.testCases) * 100 : 0));
  const accent = overall !== null ? color(overall) : 'var(--text-muted)';

  return (
    <Widget title="Pass Rate" className={className}>
      <div className="flex flex-col gap-2.5 h-full justify-between">
        <div className="flex items-end gap-3">
          <div
            className="text-display font-semibold leading-none tracking-[-0.025em]"
            style={{ color: accent }}
          >
            {overall !== null ? `${Math.round(overall)}%` : '—'}
          </div>
          {trendValues.length >= 2 && trendValues.some(v => v > 0) && (
            <div className="pb-1">
              <Sparkline data={trendValues} color={accent} width={88} height={28} strokeWidth={1.75} />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          {totalCases > 0 ? (
            <span className="text-body-sm text-secondary font-mono">
              {totalPassed} / {totalCases} cases passed
            </span>
          ) : (
            <span className="text-body-sm text-muted italic">No completed runs in range</span>
          )}
          {overview.suitePassRates.length > 0 && (
            <span className="text-caption text-muted">
              across {overview.suitePassRates.length} suite{overview.suitePassRates.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </Widget>
  );
}
