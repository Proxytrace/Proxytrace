import { useId, useMemo } from 'react';
import { computeSegmentedGauge } from './chart-math';

interface SegmentedGaugeProps {
  value: number;
  size?: number;
  label?: string;
}

export function SegmentedGauge({ value, size = 180, label }: SegmentedGaugeProps) {
  const gauge = useMemo(() => computeSegmentedGauge(value, size), [value, size]);
  const glowId = useId();
  const s = size / 220;
  const numSize = 48 * s + 8;
  const pctSize = 18 * s + 4;
  const labelSize = 8 * s + 3;

  return (
    <svg width={size} height={size} style={{ display: 'block' }} role="img" aria-label={`${value}% pass rate`}>
      <defs>
        <filter id={glowId}>
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {gauge.segments.map((seg, i) => (
        <line
          key={i}
          x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
          stroke={seg.active ? seg.color : 'var(--border-color)'}
          strokeWidth={3 * s + 0.6}
          strokeLinecap="round"
          filter={seg.glow ? `url(#${glowId})` : undefined}
        />
      ))}
      <text x={gauge.cx} y={gauge.cy + numSize * 0.12} textAnchor="middle" fontSize={numSize} fontWeight={800} fill="var(--text-primary)" style={{ letterSpacing: '-0.04em' }}>
        {value}
        <tspan fontSize={pctSize} fill="var(--text-secondary)" dx="2" dy={-pctSize * 0.18}>%</tspan>
      </text>
      {label && (
        <text x={gauge.cx} y={gauge.cy + numSize * 0.55} textAnchor="middle" fontSize={labelSize} fill="var(--text-muted)" fontFamily="JetBrains Mono, monospace" letterSpacing="0.18em">{label}</text>
      )}
    </svg>
  );
}
