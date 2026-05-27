import { KpiCard } from '../../../components/ui/KpiCard';
import { fmtCost } from '../../../lib/format';
import type { KpiProps } from './kpiRange';

export function KpiCost({ overview, className }: KpiProps) {
  const data = overview.timeSeries.map(p => p.costEur);
  return (
    <div className={className}>
      <KpiCard
        title="Cost"
        value={fmtCost(overview.summary.totalCostEur)}
        subtitle="cumulative across endpoints"
        sparkline={data}
        sparklineColor="var(--warn)"
      />
    </div>
  );
}
