import { useCallback, useMemo, useRef, useState } from 'react';
import { computeTimeline, timeToX, xToTime, timelineAxisTicks, zoomTowardPivot } from './chart-math';
import { useElementWidth } from '../../hooks/useElementWidth';
import { useWheelZoom } from '../../hooks/useWheelZoom';
import type { TraceHistogramBucket } from '../../api/models';

/** Don't let a zoom-in narrow the window below this — past it the histogram is just noise. */
const MIN_ZOOM_SPAN_MS = 1000;
/** Fraction of the span kept per wheel-in step (smaller = faster zoom). */
const WHEEL_ZOOM_FACTOR = 0.8;

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

export function TraceTimeline({ buckets, from, to, onZoom, onZoomOut, canZoomOut, height = 84 }: Props) {
  const [ref, measuredWidth] = useElementWidth<HTMLDivElement>(600);
  const w = measuredWidth || 600;
  const geo = useMemo(() => computeTimeline(buckets, w, height), [buckets, w, height]);
  // One tick per ~120px of strip width, kept between 2 and 7 so labels never crowd.
  const ticks = useMemo(() => {
    const count = Math.max(2, Math.min(7, Math.round(w / 120)));
    return timelineAxisTicks(from, to, geo.plotL, geo.plotR, count);
  }, [from, to, geo.plotL, geo.plotR, w]);
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

  // Zoom the window down to a single bucket's [start, nextStart) slice.
  const zoomIntoBucket = (idx: number) => {
    if (idx < 0 || idx >= buckets.length) return;
    const start = new Date(buckets[idx].start).getTime();
    const end = idx + 1 < buckets.length ? new Date(buckets[idx + 1].start).getTime() : to;
    if (end > start) onZoom({ from: start, to: end });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const moved = drag.current ? Math.abs(e.clientX - drag.current.startX) : 0;
    if (drag.current && dragSel && moved >= 4) {
      onZoom(dragSel);
    } else if (moved < 4) {
      // A click (not a drag) focuses the bucket under the cursor.
      const idx = bucketAt(e.clientX);
      if (idx !== null) zoomIntoBucket(idx);
    }
    drag.current = null;
    setDragSel(null);
  };

  // Mouse-wheel: scroll up zooms in toward the cursor, scroll down steps back out.
  const handleWheelZoomIn = useCallback((clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const xVb = ((clientX - rect.left) / rect.width) * w;
    const cursorT = xToTime(xVb, from, to, geo.plotL, geo.plotR);
    const next = zoomTowardPivot(cursorT, from, to, WHEEL_ZOOM_FACTOR);
    if (next.to - next.from >= MIN_ZOOM_SPAN_MS) onZoom(next);
  }, [from, to, geo.plotL, geo.plotR, w, onZoom, ref]);

  useWheelZoom(ref, handleWheelZoomIn, onZoomOut);

  const selX1 = dragSel ? timeToX(dragSel.from, from, to, geo.plotL, geo.plotR) : 0;
  const selX2 = dragSel ? timeToX(dragSel.to, from, to, geo.plotL, geo.plotR) : 0;
  const hoverBucket = hoverIdx !== null ? buckets[hoverIdx] : null;

  return (
    <div
      ref={ref}
      data-testid="traces-timeline"
      className="relative w-full shrink-0 select-none cursor-crosshair rounded-md border border-border bg-card shadow-[var(--shadow-pill)]"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => setHoverIdx(null)}
      title={
        canZoomOut
          ? 'Scroll or drag to zoom in · click a bar to focus it · scroll down to zoom out'
          : 'Scroll or drag to zoom in · click a bar to focus it'
      }
    >
      <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} className="block">
        {/* Faint vertical guides under the bars, aligned to the interior axis ticks. */}
        {ticks.slice(1, -1).map((t, i) => (
          <line key={`g${i}`} x1={t.x} x2={t.x} y1={geo.plotT} y2={geo.baselineY} stroke="var(--border-subtle)" />
        ))}
        <line x1={geo.plotL} x2={geo.plotR} y1={geo.baselineY} y2={geo.baselineY} stroke="var(--border-color)" />
        {geo.bars.map((b, i) => (
          <g key={i}>
            {b.totalH > 0 && (
              <rect x={b.x} y={b.totalY} width={b.w} height={b.totalH} fill="var(--accent-primary)" opacity={hoverIdx === i ? 0.95 : 0.7} rx={1} />
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
        {/* Time axis: a short tick + label under the baseline. */}
        {ticks.map((t, i) => (
          <g key={`t${i}`}>
            <line x1={t.x} x2={t.x} y1={geo.baselineY} y2={geo.baselineY + 3} stroke="var(--border-color)" />
            <text
              x={t.x}
              y={height - 4}
              textAnchor={t.anchor}
              fill="var(--text-muted)"
              fontSize="9"
              fontFamily="JetBrains Mono, monospace"
            >
              {t.label}
            </text>
          </g>
        ))}
      </svg>
      {buckets.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-body-sm text-muted">
          No traces in this range{canZoomOut ? ' · scroll down to zoom out' : ''}
        </div>
      )}
      {hoverBucket && (
        <div className="pointer-events-none absolute top-1 left-1 rounded-sm bg-card px-2 py-1 text-caption text-secondary shadow-[var(--shadow-float)]">
          {new Date(hoverBucket.start).toLocaleTimeString()} · {hoverBucket.total} traces
          {hoverBucket.errors > 0 && <span className="text-[var(--danger)]"> · {hoverBucket.errors} err</span>}
        </div>
      )}
    </div>
  );
}
