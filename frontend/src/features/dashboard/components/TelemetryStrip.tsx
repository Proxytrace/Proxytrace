// Live telemetry strip shown at the top of the dashboard.

import { useLingui } from '@lingui/react/macro';
import type { LiveTelemetryDto } from '../../../api/models';
import { fmtLatency } from '../../../lib/format';
import { teleFmt, type LatencyStats } from '../dashboardMeta';
import { TeleCell } from './TeleCell';

interface TelemetryStripProps {
  telemetry: LiveTelemetryDto | undefined;
  latencyStats: LatencyStats | null;
}

export function TelemetryStrip({ telemetry, latencyStats }: TelemetryStripProps) {
  const { t } = useLingui();
  return (
    // overflow-x-auto: on narrow screens the strip pans horizontally instead of clipping cells.
    <div className="fade-up relative flex items-center overflow-x-auto overflow-y-hidden rounded-md bg-card px-3.5 py-[7px] shadow-[var(--shadow-card)] [animation-delay:40ms]">
      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[linear-gradient(180deg,var(--accent-primary),transparent_80%)]" />
      <TeleCell label={t`traces / min`} value={teleFmt(telemetry?.tracesPerMinute, n => n.toFixed(1))} accent />
      <TeleCell label={t`tokens / sec`} value={teleFmt(telemetry?.tokensPerSecond, n => String(Math.round(n)))} />
      <TeleCell label={t`queue depth`} value={teleFmt(telemetry?.queueDepth, n => String(n))} />
      <TeleCell label={t`error rate`} value={teleFmt(telemetry?.errorRate, n => `${(n * 100).toFixed(1)}%`)} />
      <TeleCell
        label={t`p95 latency`}
        value={latencyStats ? fmtLatency(latencyStats.p95) : teleFmt(telemetry?.p95Ms, fmtLatency)}
      />
      <TeleCell label={t`proxy`} value={teleFmt(telemetry?.proxyVersion)} />
    </div>
  );
}
