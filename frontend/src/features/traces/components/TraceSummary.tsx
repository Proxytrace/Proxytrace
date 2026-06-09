import { fmtTokens, fmtLatency, fmtPct, fmtCostEur } from '../../../lib/format';
import type { TraceSummaryStats } from '../traceSummary';

interface StatTileProps {
  label: string;
  value: string;
  sub: string;
  testId: string;
}

function StatTile({ label, value, sub, testId }: StatTileProps) {
  return (
    <div data-testid={testId} className="bg-card rounded-lg px-3 py-2 shadow-[var(--shadow-card)]">
      <div className="text-caption text-muted">{label}</div>
      <div className="text-h1 font-semibold text-primary tabular-nums leading-tight">{value}</div>
      <div className="text-caption text-muted truncate">{sub}</div>
    </div>
  );
}

interface Props {
  stats: TraceSummaryStats;
}

/** Compact stats band for the traces currently on the page (the current pagination slice). */
export function TraceSummary({ stats }: Props) {
  if (stats.count === 0) return null;

  const totalTokens = stats.inputTokens + stats.outputTokens;

  return (
    <div
      data-testid="trace-summary"
      className="fade-up grid gap-2 shrink-0 [animation-delay:40ms] grid-cols-[repeat(auto-fit,minmax(150px,1fr))]"
    >
      <StatTile testId="trace-summary-count" label="Traces" value={stats.count.toLocaleString()} sub="on this page" />
      <StatTile
        testId="trace-summary-tokens"
        label="Tokens"
        value={fmtTokens(totalTokens)}
        sub={`${fmtTokens(stats.inputTokens)} in · ${fmtTokens(stats.outputTokens)} out`}
      />
      <StatTile testId="trace-summary-cost" label="Cost" value={fmtCostEur(stats.totalCostEur)} sub="this page" />
      <StatTile
        testId="trace-summary-latency"
        label="Avg latency"
        value={fmtLatency(stats.avgLatencyMs)}
        sub={`± ${fmtLatency(stats.latencyStdDevMs)}`}
      />
      <StatTile
        testId="trace-summary-errorrate"
        label="Error rate"
        value={fmtPct(stats.errorRate)}
        sub={`${stats.errorCount.toLocaleString()} non-2xx`}
      />
    </div>
  );
}
