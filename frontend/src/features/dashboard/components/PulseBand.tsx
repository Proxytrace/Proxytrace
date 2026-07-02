// Full-width live pulse band — the dashboard's signature element. An EKG-style
// call-rate line over the trailing hour, beating in real time via SSE, flanked
// by the live telemetry counters.

import { useId } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import type { LiveTelemetryDto } from '../../../api/models';
import { sparklinePath } from '../../../lib/charts';
import { useElementWidth } from '../../../hooks/useElementWidth';
import { teleFmt } from '../dashboardMeta';
import { cn } from '../../../lib/cn';

const BAND_HEIGHT = 72;

interface PulseBandProps {
  pulse: number[];
  lastBeat: number;
  telemetry: LiveTelemetryDto | undefined;
}

export function PulseBand({ pulse, lastBeat, telemetry }: PulseBandProps) {
  const { t } = useLingui();
  const gradId = useId();
  const glowId = useId();
  const [ref, width] = useElementWidth<HTMLDivElement>(600);
  const idle = pulse.every(v => v === 0);
  const line = idle
    ? // eslint-disable-next-line lingui/no-unlocalized-strings -- SVG path commands
      `M 0 ${BAND_HEIGHT - 4} L ${width} ${BAND_HEIGHT - 4}`
    : sparklinePath(pulse, width, BAND_HEIGHT);
  const errorPct = Math.round((telemetry?.errorRate ?? 0) * 100);

  return (
    <div
      data-testid="pulse-band"
      className={cn(
        'relative overflow-hidden rounded-lg bg-card shadow-[var(--shadow-card)] px-4 py-3 flex items-stretch gap-5',
        idle && 'pulse-idle-sweep',
      )}
    >
      <div className="absolute -top-16 left-1/4 w-[480px] h-[200px] pointer-events-none bg-[radial-gradient(ellipse,var(--accent-subtle),transparent_70%)]" />

      {/* EKG line */}
      <div ref={ref} className="relative flex-1 min-w-0">
        <div className="text-caption text-muted tracking-[0.16em] uppercase font-bold font-mono mb-1">
          <Trans>Activity · last 60 min</Trans>
        </div>
        <svg width="100%" height={BAND_HEIGHT} className="block overflow-visible" aria-hidden="true">
          <defs>
            <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.35" />
              <stop offset="75%" stopColor="var(--accent-primary)" />
              <stop offset="100%" stopColor="var(--accent-hover)" />
            </linearGradient>
            <filter id={glowId} x="-20%" y="-50%" width="140%" height="200%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <path d={line} fill="none" stroke={`url(#${gradId})`} strokeWidth={2} filter={`url(#${glowId})`} />
        </svg>
        {lastBeat > 0 && <span key={lastBeat} className="pulse-sweep" />}
      </div>

      {/* Live counters */}
      <div className="relative flex items-center gap-6 pl-5 border-l border-hairline shrink-0">
        <PulseCounter label={t`traces/min`} value={teleFmt(telemetry?.tracesPerMinute)} accent />
        <PulseCounter label={t`tokens/s`} value={teleFmt(telemetry?.tokensPerSecond, v => String(Math.round(v)))} />
        <PulseCounter label={t`errors`} value={telemetry ? `${errorPct}%` : '—'} danger={errorPct > 0} />
      </div>
    </div>
  );
}

interface PulseCounterProps {
  label: string;
  value: string;
  accent?: boolean;
  danger?: boolean;
}

function PulseCounter({ label, value, accent, danger }: PulseCounterProps) {
  return (
    <div className="flex flex-col items-end gap-0.5">
      {/* Keying on the value restarts the tick animation on every change. */}
      <span
        key={value}
        className={cn(
          'digit-tick font-mono text-display font-semibold tabular-nums leading-none',
          danger ? 'text-danger drop-shadow-[0_0_8px_var(--danger)]' : accent ? 'text-accent-hover' : 'text-primary',
        )}
      >
        {value}
      </span>
      <span className="text-caption text-muted font-mono uppercase tracking-[0.14em]">{label}</span>
    </div>
  );
}
