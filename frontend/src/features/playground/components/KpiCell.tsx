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
  good: { color: 'var(--success)', bg: 'var(--success-subtle)', border: 'rgba(61,170,111,0.20)' },
  warn: { color: 'var(--warn)', bg: 'var(--warn-subtle)', border: 'rgba(212,145,92,0.22)' },
  danger: { color: 'var(--danger)', bg: 'var(--danger-subtle)', border: 'rgba(217,85,85,0.22)' },
  live: { color: 'var(--accent-hover)', bg: 'var(--accent-subtle)', border: 'rgba(201,148,74,0.22)' },
};

export function KpiCell({ icon, label, value, tone = 'neutral', tooltip }: Props) {
  const t = TONE[tone];
  return (
    <div
      title={tooltip}
      className="flex items-center gap-[8px] px-[10px] py-[6px] rounded-[10px] border min-w-0"
      style={{ background: t.bg, borderColor: t.border, boxShadow: 'var(--shadow-pill)' }}
      role="status"
      aria-label={`${label}: ${value}`}
    >
      <span className="shrink-0 inline-flex" style={{ color: t.color }}>{icon}</span>
      <div className="flex flex-col leading-tight min-w-0">
        <span className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</span>
        <span
          className="mono text-[12px] tabular-nums truncate"
          style={{ color: t.color }}
        >
          {value}
        </span>
      </div>
    </div>
  );
}
