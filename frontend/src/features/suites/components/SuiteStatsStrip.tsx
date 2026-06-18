import type { SuiteRunStatsDto } from '../../../api/models';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { fmtCost, fmtDuration, fmtPct100 } from '../../../lib/format';
import { SUITE_WINDOW_KEYS, suiteWindowLabel, suiteWindowShortLabel, type SuiteWindowKey } from '../suiteWindow';
import { passRateTextClass } from '../suitesMeta';
import { StatCell } from '../../evaluators/components/StatCell';

interface Props {
  stats: SuiteRunStatsDto | undefined;
  isLoading: boolean;
  windowKey: SuiteWindowKey;
  onWindowChange: (k: SuiteWindowKey) => void;
}

/** Performance region inside the suite workspace card: a window toggle and a four-tile KPI strip
 * (pass rate, runs, avg duration, total cost) for the selected window. Rendered flush — the
 * enclosing workspace card owns the surface, so this only contributes hairline dividers. */
export function SuiteStatsStrip({ stats, isLoading, windowKey, onWindowChange }: Props) {
  const runCount = stats?.runCount ?? 0;

  return (
    <section className="shrink-0 border-b border-hairline" data-testid="suite-stats-strip">
      <div className="flex items-center gap-2.5 px-5 py-3">
        <span className="text-[10px] text-muted uppercase tracking-[0.09em] font-semibold">Performance</span>
        <span className="text-[11px] text-muted font-mono">
          {runCount.toLocaleString()} run{runCount !== 1 ? 's' : ''} · {suiteWindowLabel(windowKey)}
        </span>
        <SegmentedControl<SuiteWindowKey>
          className="ml-auto"
          value={windowKey}
          onChange={onWindowChange}
          segments={SUITE_WINDOW_KEYS.map(k => ({ value: k, label: suiteWindowShortLabel(k), ariaLabel: suiteWindowLabel(k) }))}
        />
      </div>

      <div className="grid grid-cols-4 border-t border-hairline">
        <StatCell
          label="Pass rate"
          value={stats?.passRate != null ? fmtPct100(stats.passRate) : '—'}
          sub={isLoading ? 'loading…' : 'over window'}
          valueClass={passRateTextClass(stats?.passRate ?? null)}
          big
        />
        <StatCell
          label="Runs"
          value={runCount.toLocaleString()}
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
    </section>
  );
}
