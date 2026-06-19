import { Plural, useLingui } from '@lingui/react/macro';
import type { SuiteRunStatsDto } from '../../../api/models';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { cn } from '../../../lib/cn';
import { fmtCost, fmtDuration, fmtPct100 } from '../../../lib/format';
import { SUITE_WINDOW_KEYS, suiteWindowLabel, suiteWindowShortLabel, type SuiteWindowKey } from '../suiteWindow';
import { passRateTextClass } from '../suitesMeta';

interface Props {
  stats: SuiteRunStatsDto | undefined;
  isLoading: boolean;
  windowKey: SuiteWindowKey;
  onWindowChange: (k: SuiteWindowKey) => void;
}

/** Performance region inside the suite workspace card: a compact inline KPI strip (pass rate, runs,
 * avg duration, total cost) for the selected window, with the window toggle on the right. Rendered
 * flush — the enclosing workspace card owns the surface, so this only contributes a hairline divider.
 * Metrics are separated by spacing, not borders, and kept to two tight lines to stay shallow. */
export function SuiteStatsStrip({ stats, isLoading, windowKey, onWindowChange }: Props) {
  const { t } = useLingui();
  const runCount = stats?.runCount ?? 0;
  const dash = isLoading ? '…' : '—';

  return (
    <section className="shrink-0 border-b border-hairline px-5 py-3" data-testid="suite-stats-strip">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-x-8 gap-y-2 flex-wrap">
          <Metric
            label={t`Pass rate`}
            value={stats?.passRate != null ? fmtPct100(stats.passRate) : dash}
            valueClass={passRateTextClass(stats?.passRate ?? null)}
            big
          />
          <Metric label={t`Runs`} value={runCount.toLocaleString()} valueClass="text-primary" />
          <Metric
            label={t`Avg duration`}
            value={stats?.avgDurationMs != null ? fmtDuration(stats.avgDurationMs) : dash}
            valueClass="text-teal"
          />
          <Metric
            label={t`Total cost`}
            value={stats?.totalCost != null ? fmtCost(stats.totalCost) : dash}
            valueClass="text-warn"
          />
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <SegmentedControl<SuiteWindowKey>
            value={windowKey}
            onChange={onWindowChange}
            segments={SUITE_WINDOW_KEYS.map(k => ({ value: k, label: suiteWindowShortLabel(k), ariaLabel: suiteWindowLabel(k) }))}
          />
          <span className="text-caption text-muted font-mono">
            {runCount.toLocaleString()} <Plural value={runCount} one="run" other="runs" /> · {suiteWindowLabel(windowKey)}
          </span>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, valueClass, big = false }: { label: string; value: string; valueClass: string; big?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-caption text-muted uppercase tracking-[0.07em] font-semibold">{label}</span>
      <span className={cn('font-mono font-semibold tracking-[-0.02em] leading-none', big ? 'text-h1' : 'text-h2', valueClass)}>
        {value}
      </span>
    </div>
  );
}
