import { useMemo, useState } from 'react';
import type { HistogramBinDto } from '../../api/models';
import { useElementWidth } from '../../hooks/useElementWidth';
import { ChartTooltip } from './ChartTooltip';

interface DensityCurveProps {
  bins: HistogramBinDto[];
  color: string;
  /** Formats a bin edge in the metric's unit (tokens, ms, €, …). */
  formatValue: (v: number) => string;
  /** Formats a bin's sample count for the hover tooltip (e.g. "12 calls"). Falls back to the bare
   *  number — pass this so the tooltip says *what* the count is, not just a digit. */
  formatCount?: (count: number) => string;
  /** Unit word appended to the tooltip's value range (e.g. "tokens") when {@link formatValue} doesn't
   *  already carry one. The tooltip can cover the card's header, so this keeps the range unambiguous. */
  valueUnit?: string;
  height?: number;
}

/* eslint-disable lingui/no-unlocalized-strings -- SVG path command strings, not UI copy */
/** Catmull-Rom through the points, emitted as cubic béziers — a smooth curve, no bar steps. */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return pts.length ? `M ${pts[0].x} ${pts[0].y}` : '';
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}
/* eslint-enable lingui/no-unlocalized-strings */

/**
 * Smooth density curve of a pre-binned sample: the distribution's *shape* as a flat tinted area
 * under a Catmull-Rom line instead of discrete bars. Hover reads a bin's value range and count.
 * A single bin (every sample equal) collapses to a centered marker.
 */
export function DensityCurve({ bins, color, formatValue, formatCount, valueUnit, height = 22 }: DensityCurveProps) {
  const [ref, measuredWidth] = useElementWidth<HTMLDivElement>(240);
  const w = measuredWidth || 240;
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const geom = useMemo(() => {
    if (bins.length < 2) return null;
    const maxCount = Math.max(...bins.map(b => b.count), 1);
    const padY = 3;
    const n = bins.length;
    const pts = bins.map((b, i) => ({
      x: (i / (n - 1)) * w,
      y: padY + (1 - b.count / maxCount) * (height - padY * 2),
    }));
    const line = smoothPath(pts);
    // eslint-disable-next-line lingui/no-unlocalized-strings -- SVG path commands
    const area = `${line} L ${w} ${height} L 0 ${height} Z`;
    return { pts, line, area };
  }, [bins, w, height]);

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box || bins.length === 0) return;
    const xVb = ((e.clientX - box.left) / box.width) * w;
    setHoverIdx(Math.max(0, Math.min(bins.length - 1, Math.round((xVb / w) * (bins.length - 1)))));
  };

  const hoverBin = hoverIdx !== null ? bins[hoverIdx] : null;

  // Single bin (every sample equal): a smooth curve is meaningless — show a centered marker.
  if (!geom) {
    return (
      <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} className="block" preserveAspectRatio="none">
        <rect x={44} y={height / 2 - 4} width={12} height={8} fill={color} opacity={0.6} />
      </svg>
    );
  }

  return (
    <div ref={ref} className="relative w-full" onMouseMove={handleMove} onMouseLeave={() => setHoverIdx(null)}>
      <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} className="block overflow-visible">
        <path d={geom.area} fill={color} fillOpacity={0.18} />
        <path d={geom.line} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        {hoverIdx !== null && (
          <line
            x1={geom.pts[hoverIdx].x}
            x2={geom.pts[hoverIdx].x}
            y1={0}
            y2={height}
            stroke={color}
            strokeOpacity="0.4"
            strokeWidth="1"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      {hoverBin && hoverIdx !== null && (
        <ChartTooltip
          leftPct={(geom.pts[hoverIdx].x / w) * 100}
          topPct={(geom.pts[hoverIdx].y / height) * 100}
          label={`${formatValue(hoverBin.start)}–${formatValue(hoverBin.end)}${valueUnit ? ` ${valueUnit}` : ''}`}
          value={formatCount ? formatCount(hoverBin.count) : String(hoverBin.count)}
          color={color}
        />
      )}
    </div>
  );
}
