import { Trans } from '@lingui/react/macro';
import type { AgentOverviewDto } from '../../../api/models';
import { type RangeKey } from '../../../lib/time-range';
import { RangeTabs } from './RangeTabs';
import { TrendStats } from './TrendStats';
import { DistributionStats } from './DistributionStats';
import { STAT_GRID_CLS } from './statCells';

interface Props {
  agentId: string;
  overview?: AgentOverviewDto;
  isLoading: boolean;
  range: RangeKey;
  onRangeChange: (r: RangeKey) => void;
  className?: string;
}

/**
 * The agent's stats home: window **totals** (each with a trend sparkline) and the per-call/per-conv
 * **distribution** of each metric, as one card per stat in a single reflowing grid — totals first,
 * distributions after, packing to the available width. One card, one range selector.
 */
export function PerformanceCard({ agentId, overview, isLoading, range, onRangeChange, className }: Props) {
  return (
    <section
      data-testid="agent-performance"
      className={`bg-card rounded-lg overflow-hidden shadow-[var(--shadow-card)] ${className ?? ''}`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 px-4 py-3 border-b border-hairline">
        <span className="text-h2 font-semibold tracking-[-0.005em]"><Trans>Performance</Trans></span>
        <span className="inline-flex items-center gap-1.5 text-body-sm text-success">
          <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-success" />
          <Trans>live</Trans>
        </span>
        <div className="ml-auto">
          <RangeTabs value={range} onChange={onRangeChange} />
        </div>
      </div>
      <div className={`p-3 ${STAT_GRID_CLS}`}>
        <TrendStats overview={overview} isLoading={isLoading} range={range} />
        <DistributionStats agentId={agentId} range={range} />
      </div>
    </section>
  );
}
