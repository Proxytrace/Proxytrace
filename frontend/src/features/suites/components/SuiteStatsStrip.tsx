import type { SuiteRunStatsDto } from '../../../api/models';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Skeleton } from '../../../components/ui/Skeleton';
import { fmtCost, fmtDuration } from '../../../lib/format';
import { SUITE_WINDOW_KEYS, suiteWindowLabel, type SuiteWindowKey } from '../suiteWindow';
import { passRateColor } from '../suitesMeta';

interface Props {
  stats: SuiteRunStatsDto | undefined;
  isLoading: boolean;
  windowKey: SuiteWindowKey;
  onWindowChange: (k: SuiteWindowKey) => void;
}

export function SuiteStatsStrip({ stats, isLoading, windowKey, onWindowChange }: Props) {
  return (
    <div className="flex flex-col gap-2" data-testid="suite-stats-strip">
      <SegmentedControl<SuiteWindowKey>
        value={windowKey}
        onChange={onWindowChange}
        segments={SUITE_WINDOW_KEYS.map(k => ({ value: k, label: suiteWindowLabel(k) }))}
      />
      {isLoading ? (
        <Skeleton height={64} className="rounded-md" />
      ) : (
        <div className="grid grid-cols-4 gap-2">
          <Tile
            label="Pass rate"
            value={stats?.passRate != null ? `${Math.round(stats.passRate)}%` : '—'}
            color={passRateColor(stats?.passRate ?? null)}
            testid="suite-stat-pass-rate"
          />
          <Tile label="Runs" value={String(stats?.runCount ?? 0)} testid="suite-stat-run-count" />
          <Tile
            label="Avg duration"
            value={stats?.avgDurationMs != null ? fmtDuration(stats.avgDurationMs) : '—'}
            testid="suite-stat-duration"
          />
          <Tile
            label="Total cost"
            value={stats?.totalCost != null ? fmtCost(stats.totalCost) : '—'}
            testid="suite-stat-cost"
          />
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, color, testid }: { label: string; value: string; color?: string; testid: string }) {
  return (
    <div className="px-3 py-2 bg-card-2 rounded-md" data-testid={testid}>
      <div className="text-caption text-muted font-semibold tracking-[0.07em] uppercase mb-1">{label}</div>
      <div className="text-[18px] font-bold tracking-[-0.02em]" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  );
}
