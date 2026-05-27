import { KpiCard } from '../../../components/ui/KpiCard';
import { rangeShort, type KpiProps } from './kpiRange';

export function KpiTraces({ overview, range, className }: KpiProps) {
  const data = overview.timeSeries.map(p => p.traceCount);
  return (
    <div className={className}>
      <KpiCard
        title="Traces"
        value={String(overview.summary.totalTraces)}
        subtitle={`in ${rangeShort(range)}`}
        sparkline={data}
        sparklineColor="var(--accent-primary)"
      />
    </div>
  );
}
