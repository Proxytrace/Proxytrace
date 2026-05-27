import { KpiCard } from '../../../components/ui/KpiCard';
import { fmtLatency } from '../../../lib/format';
import type { KpiProps } from './kpiRange';

export function KpiLatency({ overview, className }: KpiProps) {
  const data = overview.timeSeries.map(p => p.avgLatencyMs);
  return (
    <div className={className}>
      <KpiCard
        title="Avg Latency"
        value={fmtLatency(overview.summary.avgLatencyMs)}
        subtitle="per call"
        sparkline={data}
        sparklineColor="var(--success)"
      />
    </div>
  );
}
