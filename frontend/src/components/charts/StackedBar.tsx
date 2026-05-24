import { useMemo } from 'react';
import { computeStackedBar, roundedTopRectPath, type StackedDatum } from './chart-math';
import { useElementWidth } from '../../hooks/useElementWidth';

interface StackedBarProps {
  data: StackedDatum[];
  width?: number;
  height?: number;
}

export function StackedBar({ data, width = 640, height = 200 }: StackedBarProps) {
  const [ref, measuredWidth] = useElementWidth<HTMLDivElement>(width);
  const w = measuredWidth || width;
  const chart = useMemo(() => computeStackedBar(data, w, height), [data, w, height]);

  return (
    <div ref={ref}>
      <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} style={{ display: 'block' }}>
        <path d={chart.solidGridPath} stroke="var(--border-color)" strokeWidth="1" fill="none" />
        <path d={chart.dashedGridPath} stroke="var(--border-color)" strokeWidth="1" strokeDasharray="3 4" fill="none" />
        {chart.grid.map((g, i) => (
          <text key={i} x={chart.plotL - 8} y={g.y + 4} textAnchor="end" fill="var(--text-muted)" fontSize="10" fontFamily="JetBrains Mono, monospace">{g.val}</text>
        ))}
        {chart.bars.map((bar, i) => (
          <g key={i}>
            {bar.rects.map((r, j) =>
              r.top
                ? <path key={j} d={roundedTopRectPath(r.x, r.y, r.w, r.h, 3)} fill={r.color} />
                : <rect key={j} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.color} />,
            )}
            <text x={bar.centerX} y={height - 10} textAnchor="middle" fill="var(--text-muted)" fontSize="10" fontFamily="JetBrains Mono, monospace">{bar.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
