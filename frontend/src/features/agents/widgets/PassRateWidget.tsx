import type { AgentOverviewDto } from '../../../api/models';
import { Sparkline } from '../../../components/charts';
import { Widget } from './Widget';

interface Props {
  overview: AgentOverviewDto;
  className?: string;
}

function color(pct: number): string {
  if (pct >= 80) return '#3daa6f';
  if (pct >= 50) return '#c9944a';
  return '#d4915c';
}

export function PassRateWidget({ overview, className }: Props) {
  const trend = overview.passRateTrend;
  const totalCases = trend.reduce((s, p) => s + p.testCases, 0);
  const totalPassed = trend.reduce((s, p) => s + p.passed, 0);
  const overall = totalCases > 0 ? (totalPassed / totalCases) * 100 : null;
  const trendValues = trend.map(p => (p.testCases > 0 ? (p.passed / p.testCases) * 100 : 0));
  const accent = overall !== null ? color(overall) : '#67645e';

  return (
    <Widget title="Pass Rate" className={className}>
      <div className="flex flex-col gap-[10px] h-full justify-between">
        <div className="flex items-end gap-3">
          <div
            className="text-[44px] font-bold leading-none tracking-[-0.03em]"
            style={{ color: accent }}
          >
            {overall !== null ? `${Math.round(overall)}%` : '—'}
          </div>
          {trendValues.length >= 2 && trendValues.some(v => v > 0) && (
            <div className="pb-[6px]">
              <Sparkline data={trendValues} color={accent} width={90} height={32} strokeWidth={1.75} />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-[2px]">
          {totalCases > 0 ? (
            <span className="text-[11.5px] text-secondary font-mono">
              {totalPassed} / {totalCases} cases passed
            </span>
          ) : (
            <span className="text-[11.5px] text-muted italic">No completed runs in range</span>
          )}
          {overview.suitePassRates.length > 0 && (
            <span className="text-[10.5px] text-muted">
              across {overview.suitePassRates.length} suite{overview.suitePassRates.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </Widget>
  );
}
