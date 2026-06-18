import type { SuiteRunStatsDto } from '../../../api/models';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { AreaChart } from '../../../components/charts';
import { fmtCost, fmtDuration, fmtPct100 } from '../../../lib/format';
import { SUITE_WINDOW_KEYS, suiteWindowLabel, type SuiteWindowKey } from '../suiteWindow';
import { passRateTextClass } from '../suitesMeta';
import { StatCell } from '../../evaluators/components/StatCell';

interface Props {
  stats: SuiteRunStatsDto | undefined;
  isLoading: boolean;
  windowKey: SuiteWindowKey;
  onWindowChange: (k: SuiteWindowKey) => void;
  /** Pass-rate trend across past runs (percentages, oldest→newest) for the sparkline area chart. */
  trend: number[];
  /** Agent accent colour for the trend chart. */
  accentColor: string;
  /** Stable id for the chart gradient. */
  suiteId: string;
}

/** Performance card for the selected suite: window toggle, KPI strip, and a pass-rate trend chart —
 * the suites counterpart to the evaluator/agent performance panels. */
export function SuiteStatsStrip({ stats, isLoading, windowKey, onWindowChange, trend, accentColor, suiteId }: Props) {
  const hasTrend = trend.length >= 2;

  return (
    <section className="bg-card rounded-lg shadow-[var(--shadow-card)]" data-testid="suite-stats-strip">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-hairline">
        <span className="text-[10px] text-muted uppercase tracking-[0.09em] font-semibold">Performance</span>
        <span className="text-[11px] text-muted font-mono">
          {(stats?.runCount ?? 0).toLocaleString()} run{(stats?.runCount ?? 0) !== 1 ? 's' : ''} · {suiteWindowLabel(windowKey)}
        </span>
        <SegmentedControl<SuiteWindowKey>
          className="ml-auto"
          value={windowKey}
          onChange={onWindowChange}
          segments={SUITE_WINDOW_KEYS.map(k => ({ value: k, label: suiteWindowLabel(k) }))}
        />
      </div>

      <div className="grid grid-cols-4 border-b border-hairline">
        <StatCell
          label="Pass rate"
          value={stats?.passRate != null ? fmtPct100(stats.passRate) : '—'}
          sub={isLoading ? 'loading…' : 'over window'}
          valueClass={passRateTextClass(stats?.passRate ?? null)}
          big
        />
        <StatCell
          label="Runs"
          value={(stats?.runCount ?? 0).toLocaleString()}
          sub="completed"
          valueClass="text-primary"
        />
        <StatCell
          label="Avg duration"
          value={stats?.avgDurationMs != null ? fmtDuration(stats.avgDurationMs) : '—'}
          sub="per run"
          valueClass="text-teal"
        />
        <StatCell
          label="Total cost"
          value={stats?.totalCost != null ? fmtCost(stats.totalCost) : '—'}
          sub="over window"
          valueClass="text-warn"
          last
        />
      </div>

      <div className="px-[18px] py-3.5">
        <div className="text-[10px] text-muted uppercase tracking-[0.08em] font-semibold mb-2">Pass rate trend</div>
        {hasTrend ? (
          <AreaChart
            data={trend}
            width={860}
            height={120}
            color={accentColor}
            gradientId={`suiteTrend-${suiteId.slice(0, 8)}`}
            showAxis={false}
            showEndMarker
            formatValue={fmtPct100}
          />
        ) : (
          <div className="h-[120px] flex items-center justify-center text-muted text-[11.5px]">Not enough data</div>
        )}
      </div>
    </section>
  );
}
