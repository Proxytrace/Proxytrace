// Grid of KPI stat tiles in the hero row.

import { useLingui } from '@lingui/react/macro';
import { ActivityIcon, ClockIcon, ZapIcon, TargetIcon, ServerIcon, SigmaIcon } from '../../../components/icons';
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
  const { t } = useLingui();
  const passPct = Math.round((summary?.overallPassRate ?? 0) * 100);

  return (
    <div data-testid="dashboard-stat-tiles" className="grid grid-cols-2 lg:grid-cols-3 gap-2">
      <StatTile
        accent
        testId="stat-tile-traces"
        icon={<ActivityIcon size={11} />}
        label={t`Traces`}
        value={(summary?.totalCalls ?? 0).toLocaleString()}
        countTo={summary?.totalCalls ?? 0}
        formatCount={v => Math.round(v).toLocaleString()}
        sub={t`LLM calls captured`}
        delta="+24%"
        trace={trends?.traces}
        traceColor="var(--accent-primary)"
        traceFormat={v => t`${Math.round(v)} traces`}
      />
      <StatTile
        testId="stat-tile-latency"
        icon={<ClockIcon size={11} />}
        label={t`Avg Latency`}
        value={String(Math.round(summary?.avgLatencyMs ?? 0))}
        countTo={summary?.avgLatencyMs ?? 0}
        formatCount={v => String(Math.round(v))}
        unit={t`ms`}
        sub={latencyStats ? t`p95 ${fmtLatency(latencyStats.p95)} · p99 ${fmtLatency(latencyStats.p99)}` : '—'}
        delta="-8%"
        deltaUp={false}
        trace={trends?.latencyMs}
        traceColor="var(--warn)"
        traceFormat={v => fmtLatency(v)}
      />
      <StatTile
        testId="stat-tile-throughput"
        icon={<ZapIcon size={11} />}
        label={t`Throughput`}
        value={telemetry ? String(Math.round(telemetry.tokensPerSecond)) : '—'}
        countTo={telemetry ? telemetry.tokensPerSecond : undefined}
        formatCount={v => String(Math.round(v))}
        unit={t`t/s`}
        sub={telemetry ? t`p95 ${fmtLatency(telemetry.p95Ms)}` : t`awaiting telemetry`}
        delta="+18%"
        trace={trends?.throughput}
        traceColor="var(--teal)"
        traceFormat={v => t`${Math.round(v)} t/s`}
      />
      <StatTile
        testId="stat-tile-pass-rate"
        icon={<TargetIcon size={11} />}
        label={t`Pass Rate`}
        value={String(passPct)}
        countTo={passPct}
        formatCount={v => String(Math.round(v))}
        unit="%"
        sub={t`latest suite run`}
        delta={t`+7pt`}
        trace={trends?.passRate}
        traceColor="var(--success)"
        traceFormat={v => t`${v.toFixed(0)}% pass`}
      />
      <StatTile
        testId="stat-tile-queue"
        icon={<ServerIcon size={11} />}
        label={t`Queue`}
        value={telemetry ? String(telemetry.queueDepth) : '—'}
        countTo={telemetry ? telemetry.queueDepth : undefined}
        formatCount={v => String(Math.round(v))}
        sub={t`ingestion backlog`}
        traceColor="var(--teal)"
      />
      <StatTile
        testId="stat-tile-p95"
        icon={<SigmaIcon size={11} />}
        label={t`p95 Latency`}
        value={latencyStats ? String(Math.round(latencyStats.p95)) : '—'}
        countTo={latencyStats ? latencyStats.p95 : undefined}
        formatCount={v => String(Math.round(v))}
        unit={t`ms`}
        sub={latencyStats ? t`p99 ${fmtLatency(latencyStats.p99)}` : t`awaiting samples`}
        traceColor="var(--warn)"
      />
    </div>
  );
}
