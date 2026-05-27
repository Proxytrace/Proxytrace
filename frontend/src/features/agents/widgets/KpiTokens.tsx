import { KpiCard } from '../../../components/ui/KpiCard';
import { fmtTokens } from '../../../lib/format';
import type { KpiProps } from './kpiRange';

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
        sparklineColor="var(--teal)"
      />
    </div>
  );
}
