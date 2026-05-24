import { useId, useMemo } from 'react';
import { useElementWidth } from '../../hooks/useElementWidth';

interface MiniAreaProps {
  data: number[];
  color: string;
  width?: number;
  height?: number;
  fillOpacity?: number;
}

/** Compact area sparkline with gradient fill and an end-point dot. No axes. */
export function MiniArea({ data, color, width = 240, height = 26, fillOpacity = 0.18 }: MiniAreaProps) {
  const [ref, measuredWidth] = useElementWidth<HTMLDivElement>(width);
  const w = measuredWidth || width;
  const gid = useId();

  const geom = useMemo(() => {
    if (data.length < 2) return null;
    const max = Math.max(...data), min = Math.min(...data);
    const range = max - min || 1;
    const padY = 4;
    const stepX = w / (data.length - 1);
    const pts = data.map((v, i) => [i * stepX, padY + (1 - (v - min) / range) * (height - padY * 2)] as const);
    const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    const area = `${line} L ${w} ${height} L 0 ${height} Z`;
    return { line, area, end: pts[pts.length - 1] };
  }, [data, w, height]);

  return (
    <div ref={ref} style={{ width: '100%' }}>
      {geom && (
        <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} style={{ display: 'block', overflow: 'visible' }}>
          <defs>
            <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={geom.area} fill={`url(#${gid})`} />
          <path d={geom.line} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={geom.end[0]} cy={geom.end[1]} r="5" fill={color} opacity="0.18" />
          <circle cx={geom.end[0]} cy={geom.end[1]} r="2.3" fill={color} />
        </svg>
      )}
    </div>
  );
}
