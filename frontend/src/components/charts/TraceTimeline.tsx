import { useMemo, useRef, useState } from 'react';
import { computeTimeline, timeToX, xToTime } from './chart-math';
import { useElementWidth } from '../../hooks/useElementWidth';
import type { TraceHistogramBucket } from '../../api/models';

interface Props {
  buckets: TraceHistogramBucket[];
  /** Window bounds in epoch ms (the active time-range). */
  from: number;
  to: number;
  /** Drag-selected a sub-range: zoom the window (and filter) into it. */
  onZoom: (range: { from: number; to: number }) => void;
  /** Double-click: step one zoom level back out. */
  onZoomOut: () => void;
  /** Whether a zoom-out is possible (controls the hint affordance). */
  canZoomOut: boolean;
  height?: number;
}

export function TraceTimeline({ buckets, from, to, onZoom, onZoomOut, canZoomOut, height = 72 }: Props) {
  const [ref, measuredWidth] = useElementWidth<HTMLDivElement>(600);
  const w = measuredWidth || 600;
  const geo = useMemo(() => computeTimeline(buckets, w, height), [buckets, w, height]);
  const drag = useRef<{ startX: number } | null>(null);
  const [dragSel, setDragSel] = useState<{ from: number; to: number } | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const pxToTime = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return from;
    const xVb = ((clientX - rect.left) / rect.width) * w;
    return xToTime(xVb, from, to, geo.plotL, geo.plotR);
  };

  const bucketAt = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || geo.bars.length === 0) return null;
    const xVb = ((clientX - rect.left) / rect.width) * w;
    const slot = (geo.plotR - geo.plotL) / geo.bars.length;
    return Math.min(geo.bars.length - 1, Math.max(0, Math.floor((xVb - geo.plotL) / slot)));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    setHoverIdx(bucketAt(e.clientX));
    if (!drag.current) return;
    const a = pxToTime(drag.current.startX);
    const b = pxToTime(e.clientX);
    setDragSel({ from: Math.min(a, b), to: Math.max(a, b) });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (drag.current && dragSel && Math.abs(e.clientX - drag.current.startX) >= 4) {
      onZoom(dragSel);
    }
    drag.current = null;
    setDragSel(null);
  };

  const selX1 = dragSel ? timeToX(dragSel.from, from, to, geo.plotL, geo.plotR) : 0;
  const selX2 = dragSel ? timeToX(dragSel.to, from, to, geo.plotL, geo.plotR) : 0;
  const hoverBucket = hoverIdx !== null ? buckets[hoverIdx] : null;

  return (
    <div
      ref={ref}
      className="relative w-full shrink-0 select-none cursor-crosshair rounded-md bg-card shadow-[var(--shadow-pill)]"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => setHoverIdx(null)}
      onDoubleClick={onZoomOut}
      title={canZoomOut ? 'Drag to zoom in · double-click to zoom out' : 'Drag to zoom into a time range'}
    >
      <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} className="block">
        <line x1={geo.plotL} x2={geo.plotR} y1={geo.baselineY} y2={geo.baselineY} stroke="var(--border-color)" />
        {geo.bars.map((b, i) => (
          <g key={i}>
            {b.totalH > 0 && (
              <rect x={b.x} y={b.totalY} width={b.w} height={b.totalH} fill="var(--accent-primary)" opacity={0.55} rx={1} />
            )}
            {b.errorH > 0 && (
              <rect x={b.x} y={b.errorY} width={b.w} height={b.errorH} fill="var(--danger)" rx={1} />
            )}
          </g>
        ))}
        {dragSel && (
          <rect
            x={selX1} y={geo.plotT} width={Math.max(selX2 - selX1, 1)} height={geo.baselineY - geo.plotT}
            fill="var(--accent-primary)" opacity={0.12} stroke="var(--accent-primary)" strokeOpacity={0.5}
          />
        )}
      </svg>
      {hoverBucket && (
        <div className="pointer-events-none absolute top-1 left-1 rounded-sm bg-card px-2 py-1 text-caption text-secondary shadow-[var(--shadow-float)]">
          {new Date(hoverBucket.start).toLocaleTimeString()} · {hoverBucket.total} traces
          {hoverBucket.errors > 0 && <span className="text-[var(--danger)]"> · {hoverBucket.errors} err</span>}
        </div>
      )}
    </div>
  );
}
