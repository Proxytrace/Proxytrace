// Live telemetry strip shown at the top of the dashboard.

import type { LiveTelemetryDto } from '../../../api/models';
import { fmtLatency } from '../../../lib/format';
import { teleFmt, type LatencyStats } from '../dashboardMeta';
import { TeleCell } from './TeleCell';

interface TelemetryStripProps {
  telemetry: LiveTelemetryDto | undefined;
  latencyStats: LatencyStats | null;
}

export function TelemetryStrip({ telemetry, latencyStats }: TelemetryStripProps) {
  return (
    <div className="fade-up relative flex items-center overflow-hidden rounded-md bg-card px-3.5 py-[7px] shadow-[var(--shadow-card)] [animation-delay:40ms]">
      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[linear-gradient(180deg,var(--accent-primary),transparent_80%)]" />
      <TeleCell label="traces / min" value={teleFmt(telemetry?.tracesPerMinute, n => n.toFixed(1))} accent />
      <TeleCell label="tokens / sec" value={teleFmt(telemetry?.tokensPerSecond, n => String(Math.round(n)))} />
      <TeleCell label="queue depth" value={teleFmt(telemetry?.queueDepth, n => String(n))} />
      <TeleCell label="error rate" value={teleFmt(telemetry?.errorRate, n => `${(n * 100).toFixed(1)}%`)} />
      <TeleCell
        label="p95 latency"
        value={latencyStats ? fmtLatency(latencyStats.p95) : teleFmt(telemetry?.p95Ms, fmtLatency)}
      />
      <TeleCell label="proxy" value={teleFmt(telemetry?.proxyVersion)} />
    </div>
  );
}
