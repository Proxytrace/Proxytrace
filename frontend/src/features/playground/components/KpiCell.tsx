import type { ReactNode } from 'react';

type Tone = 'neutral' | 'good' | 'warn' | 'danger' | 'live';

interface Props {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: Tone;
  tooltip?: string;
}

const TONE: Record<Tone, { color: string; bg: string; border: string }> = {
  neutral: { color: 'var(--text-primary)', bg: 'rgba(255,255,255,0.03)', border: 'var(--border-color)' },
  good: { color: 'var(--success)', bg: 'var(--success-subtle)', border: 'color-mix(in srgb, var(--success) 28%, transparent)' },
  warn: { color: 'var(--warn)', bg: 'var(--warn-subtle)', border: 'color-mix(in srgb, var(--warn) 28%, transparent)' },
  danger: { color: 'var(--danger)', bg: 'var(--danger-subtle)', border: 'color-mix(in srgb, var(--danger) 28%, transparent)' },
  live: { color: 'var(--accent-hover)', bg: 'var(--accent-subtle)', border: 'var(--accent-glow)' },
};

export function KpiCell({ icon, label, value, tone = 'neutral', tooltip }: Props) {
  const t = TONE[tone];
  return (
    <div
      title={tooltip}
      className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border min-w-0 shadow-[var(--shadow-pill)]"
      style={{ background: t.bg, borderColor: t.border }}
      role="status"
      aria-label={`${label}: ${value}`}
    >
      <span className="shrink-0 inline-flex" style={{ color: t.color }}>{icon}</span>
      <div className="flex flex-col leading-tight min-w-0">
        <span className="text-caption font-semibold uppercase tracking-[0.08em] text-muted">{label}</span>
        <span
          className="mono text-body tabular-nums truncate"
          style={{ color: t.color }}
        >
          {value}
        </span>
      </div>
    </div>
  );
}
