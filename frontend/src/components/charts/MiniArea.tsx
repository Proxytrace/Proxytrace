import { useId, useMemo, useState } from 'react';
import { ChartTooltip } from './ChartTooltip';
import { useElementWidth } from '../../hooks/useElementWidth';

interface MiniAreaProps {
  data: number[];
  color: string;
  width?: number;
  height?: number;
  fillOpacity?: number;
  formatValue?: (v: number) => string;
  tooltipLabel?: (i: number) => string;
}

/** Compact area sparkline with gradient fill, end-point dot, and hover tooltip. No axes. */
export function MiniArea({ data, color, width = 240, height = 26, fillOpacity = 0.18, formatValue, tooltipLabel }: MiniAreaProps) {
  const [ref, measuredWidth] = useElementWidth<HTMLDivElement>(width);
  const w = measuredWidth || width;
  const gid = useId();
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const geom = useMemo(() => {
    if (data.length < 2) return null;
    const max = Math.max(...data), min = Math.min(...data);
    const range = max - min || 1;
    const padY = 4;
    const stepX = w / (data.length - 1);
    const pts = data.map((v, i) => ({ x: i * stepX, y: padY + (1 - (v - min) / range) * (height - padY * 2), v }));
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const area = `${line} L ${w} ${height} L 0 ${height} Z`;
    return { line, area, pts };
  }, [data, w, height]);

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box || !geom) return;
    const xVb = ((e.clientX - box.left) / box.width) * w;
    const stepX = w / (data.length - 1);
    setHoverIdx(Math.max(0, Math.min(data.length - 1, Math.round(xVb / stepX))));
  };

  const hoverPt = hoverIdx !== null && geom ? geom.pts[hoverIdx] : null;
  const end = geom ? geom.pts[geom.pts.length - 1] : null;
  const fmt = formatValue ?? ((v: number) => String(Math.round(v)));

  return (
    <div ref={ref} className="relative w-full" onMouseMove={handleMove} onMouseLeave={() => setHoverIdx(null)}>
      {geom && (
        <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} className="block overflow-visible">
          <defs>
            <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={geom.area} fill={`url(#${gid})`} />
          <path d={geom.line} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          {end && hoverIdx === null && (
            <>
              <circle cx={end.x} cy={end.y} r="5" fill={color} opacity="0.18" />
              <circle cx={end.x} cy={end.y} r="2.3" fill={color} />
            </>
          )}
          {hoverPt && (
            <>
              <line x1={hoverPt.x} x2={hoverPt.x} y1={0} y2={height} stroke={color} strokeOpacity="0.4" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
              <circle cx={hoverPt.x} cy={hoverPt.y} r="3" fill={color} />
            </>
          )}
        </svg>
      )}
      {hoverPt && hoverIdx !== null && (
        <ChartTooltip
          leftPct={(hoverPt.x / w) * 100}
          topPct={(hoverPt.y / height) * 100}
          label={tooltipLabel ? tooltipLabel(hoverIdx) : undefined}
          value={fmt(hoverPt.v)}
          color={color}
        />
      )}
    </div>
  );
}
