import { useMemo, useState } from 'react';
import type { HistogramBinDto } from '../../api/models';
import { ChartTooltip } from './ChartTooltip';
import { useElementWidth } from '../../hooks/useElementWidth';

interface MiniHistogramProps {
  bins: HistogramBinDto[];
  color: string;
  height?: number;
  /** Formats a bin edge in the metric's unit (e.g. tokens, ms, €). */
  formatValue: (v: number) => string;
}

/**
 * Compact pre-binned histogram: one bar per bin, hover highlights the bar and shows its value range
 * + sample count. No axes — the surrounding row carries the label and summary. Mirrors {@link MiniArea}.
 */
export function MiniHistogram({ bins, color, height = 34, formatValue }: MiniHistogramProps) {
  const [ref, measuredWidth] = useElementWidth<HTMLDivElement>(240);
  const w = measuredWidth || 240;
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const rects = useMemo(() => {
    if (bins.length === 0) return [];
    // A single bin means every sample shares one value — draw a centered marker bar, not a full-width
    // block that would imply the value is spread across a range.
    if (bins.length === 1) {
      const b = bins[0];
      const barW = w * 0.22;
      return [{ x: (w - barW) / 2, y: 0, w: barW, h: height, count: b.count, start: b.start, end: b.end }];
    }
    const maxCount = Math.max(...bins.map(b => b.count), 1);
    const slot = w / bins.length;
    const gap = Math.min(2, slot * 0.18);
    const barW = Math.max(1, slot - gap);
    return bins.map((b, i) => {
      const h = b.count === 0 ? 0 : Math.max(1.5, (b.count / maxCount) * height);
      return { x: i * slot + gap / 2, y: height - h, w: barW, h, count: b.count, start: b.start, end: b.end };
    });
  }, [bins, w, height]);

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box || bins.length === 0) return;
    const xVb = ((e.clientX - box.left) / box.width) * w;
    setHoverIdx(Math.max(0, Math.min(bins.length - 1, Math.floor(xVb / (w / bins.length)))));
  };

  const hover = hoverIdx !== null ? rects[hoverIdx] : null;

  return (
    <div ref={ref} className="relative w-full" onMouseMove={handleMove} onMouseLeave={() => setHoverIdx(null)}>
      <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} className="block">
        {rects.map((r, i) => (
          <rect
            key={i}
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            rx="1"
            fill={color}
            opacity={hoverIdx === null || hoverIdx === i ? 0.85 : 0.32}
          />
        ))}
      </svg>
      {hover && hover.count > 0 && (
        <ChartTooltip
          leftPct={((hover.x + hover.w / 2) / w) * 100}
          topPct={(hover.y / height) * 100}
          label={`${formatValue(hover.start)}–${formatValue(hover.end)}`}
          value={String(hover.count)}
          color={color}
        />
      )}
    </div>
  );
}
