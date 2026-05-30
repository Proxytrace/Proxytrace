// 2×2 grid of KPI stat tiles in the hero row.

import { ActivityIcon, ClockIcon, ZapIcon, TargetIcon } from '../../../components/icons';
import type { SummaryDto, LiveTelemetryDto, DashboardTrendsDto } from '../../../api/models';
import { fmtLatency } from '../../../lib/format';
import type { LatencyStats } from '../dashboardMeta';
import { StatTile } from './StatTile';

interface StatTileGridProps {
  summary: SummaryDto | undefined;
  telemetry: LiveTelemetryDto | undefined;
  trends: DashboardTrendsDto | undefined;
  latencyStats: LatencyStats | null;
}

export function StatTileGrid({ summary, telemetry, trends, latencyStats }: StatTileGridProps) {
  const passPct = Math.round((summary?.overallPassRate ?? 0) * 100);

  return (
    <div data-testid="dashboard-stat-tiles" className="grid grid-cols-2 grid-rows-2 gap-2">
      <StatTile
        accent
        testId="stat-tile-traces"
        icon={<ActivityIcon size={11} />}
        label="Traces"
        value={(summary?.totalCalls ?? 0).toLocaleString()}
        sub="LLM calls captured"
        delta="+24%"
        trace={trends?.traces}
        traceColor="var(--accent-primary)"
        traceFormat={v => `${Math.round(v)} traces`}
      />
      <StatTile
        testId="stat-tile-latency"
        icon={<ClockIcon size={11} />}
        label="Avg Latency"
        value={String(Math.round(summary?.avgLatencyMs ?? 0))}
        unit="ms"
        sub={latencyStats ? `p95 ${fmtLatency(latencyStats.p95)} · p99 ${fmtLatency(latencyStats.p99)}` : '—'}
        delta="-8%"
        deltaUp={false}
        trace={trends?.latencyMs}
        traceColor="var(--warn)"
        traceFormat={v => fmtLatency(v)}
      />
      <StatTile
        testId="stat-tile-throughput"
        icon={<ZapIcon size={11} />}
        label="Throughput"
        value={telemetry ? String(Math.round(telemetry.tokensPerSecond)) : '—'}
        unit="t/s"
        sub={telemetry ? `p95 ${fmtLatency(telemetry.p95Ms)}` : 'awaiting telemetry'}
        delta="+18%"
        trace={trends?.throughput}
        traceColor="var(--teal)"
        traceFormat={v => `${Math.round(v)} t/s`}
      />
      <StatTile
        testId="stat-tile-pass-rate"
        icon={<TargetIcon size={11} />}
        label="Pass Rate"
        value={String(passPct)}
        unit="%"
        sub="latest suite run"
        delta="+7pt"
        trace={trends?.passRate}
        traceColor="var(--success)"
        traceFormat={v => `${v.toFixed(0)}% pass`}
      />
    </div>
  );
}
