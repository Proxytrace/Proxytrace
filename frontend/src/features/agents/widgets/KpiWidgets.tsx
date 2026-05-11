import type { AgentOverviewDto } from '../../../api/models';
import { KpiCard } from '../../../components/ui/KpiCard';
import { fmtCost, fmtLatency, fmtTokens } from '../../../lib/format';
import { rangeLabel, type RangeKey } from '../../../lib/time-range';

interface KpiProps {
  overview: AgentOverviewDto;
  range: RangeKey;
  className?: string;
}

function rangeShort(range: RangeKey): string {
  return rangeLabel(range).split(' · ')[0].toLowerCase();
}

export function KpiTraces({ overview, range, className }: KpiProps) {
  const data = overview.timeSeries.map(p => p.traceCount);
  return (
    <div className={className}>
      <KpiCard
        title="Traces"
        value={String(overview.summary.totalTraces)}
        subtitle={`in ${rangeShort(range)}`}
        sparkline={data}
        sparklineColor="#c9944a"
      />
    </div>
  );
}

export function KpiTokens({ overview, className }: KpiProps) {
  const data = overview.timeSeries.map(p => p.inputTokens + p.outputTokens);
  const total = overview.summary.totalInputTokens + overview.summary.totalOutputTokens;
  return (
    <div className={className}>
      <KpiCard
        title="Tokens"
        value={fmtTokens(total)}
        subtitle={`${fmtTokens(overview.summary.totalInputTokens)} in · ${fmtTokens(overview.summary.totalOutputTokens)} out`}
        sparkline={data}
        sparklineColor="#6b9eaa"
      />
    </div>
  );
}

export function KpiCost({ overview, className }: KpiProps) {
  const data = overview.timeSeries.map(p => p.costEur);
  return (
    <div className={className}>
      <KpiCard
        title="Cost"
        value={fmtCost(overview.summary.totalCostEur)}
        subtitle="cumulative across endpoints"
        sparkline={data}
        sparklineColor="#d4915c"
      />
    </div>
  );
}

export function KpiLatency({ overview, className }: KpiProps) {
  const data = overview.timeSeries.map(p => p.avgLatencyMs);
  return (
    <div className={className}>
      <KpiCard
        title="Avg Latency"
        value={fmtLatency(overview.summary.avgLatencyMs)}
        subtitle="per call"
        sparkline={data}
        sparklineColor="#3daa6f"
      />
    </div>
  );
}
