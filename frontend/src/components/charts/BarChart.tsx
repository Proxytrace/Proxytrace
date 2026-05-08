import { useMemo } from 'react';
import { computeModelBars } from './chart-math';

interface BarChartProps {
  data: { label: string; value: number }[];
  width?: number;
  height?: number;
  color: string;
  truncateAt?: number;
}

export function BarChart({
  data,
  width = 820,
  height = 220,
  color,
  truncateAt = 10,
}: BarChartProps) {
  const bars = useMemo(() => computeModelBars(data, width, height, truncateAt), [data, width, height, truncateAt]);

  if (bars.rects.length === 0) return null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      style={{ display: 'block' }}
      preserveAspectRatio="none"
    >
      <line x1="38" x2={width - 10} y1={bars.baselineY} y2={bars.baselineY} stroke="#343438" />
      <path d={bars.barsPath} fill={color} opacity="0.85" />
      {bars.rects.map((r, i) => (
        <text key={i} x={r.labelX} y={bars.baselineY + 14} textAnchor="middle" fill="#67645e" fontSize="10" fontFamily="JetBrains Mono, monospace">{r.label}</text>
      ))}
    </svg>
  );
}
