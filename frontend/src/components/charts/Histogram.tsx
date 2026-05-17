import { useMemo } from 'react';
import { computeHistogram } from './chart-math';
import { useElementWidth } from '../../hooks/useElementWidth';

interface HistogramProps {
  data: number[];
  width?: number;
  height?: number;
  color: string;
  labels?: string[];
}

export function Histogram({
  data,
  width = 360,
  height = 200,
  color,
  labels,
}: HistogramProps) {
  const [ref, measuredWidth] = useElementWidth<HTMLDivElement>(width);
  const w = measuredWidth || width;
  const hist = useMemo(() => computeHistogram(data, w, height, labels), [data, w, height, labels]);

  return (
    <div ref={ref}>
      <svg
        viewBox={`0 0 ${w} ${height}`}
        width="100%"
        height={height}
        style={{ display: 'block' }}
      >
        <line x1="38" x2={w - 10} y1={hist.baselineY} y2={hist.baselineY} stroke="var(--border-color)" />
        <path d={hist.barsPath} fill={color} opacity="0.85" />
        {hist.rects.map((r, i) => (
          <text key={i} x={r.labelX} y={height - 8} textAnchor="middle" fill="var(--text-muted)" fontSize="9" fontFamily="JetBrains Mono, monospace">{r.label}</text>
        ))}
      </svg>
    </div>
  );
}
