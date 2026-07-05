export interface TimelineBarRect {
  x: number; w: number;
  totalY: number; totalH: number;
  errorY: number; errorH: number;
}
export interface TimelineData {
  bars: TimelineBarRect[];
  baselineY: number;
  plotL: number; plotR: number; plotT: number; plotB: number;
}

/** Stacked count+error bars filling the full width (no axis gutter — full-bleed timeline strip). */
export function computeTimeline(
  buckets: { total: number; errors: number }[],
  width: number,
  height: number,
): TimelineData {
  const padL = 2, padR = 2, padT = 6, padB = 16;
  const w = Math.max(width - padL - padR, 0);
  const h = Math.max(height - padT - padB, 0);
  const baselineY = padT + h;
  const max = Math.max(...buckets.map(b => b.total), 0) * 1.1 || 1;
  const slot = buckets.length > 0 ? w / buckets.length : w;
  const bw = slot * 0.82, gap = slot * 0.18;
  const bars: TimelineBarRect[] = buckets.map((b, i) => {
    const x = padL + i * slot + gap / 2;
    const totalH = (b.total / max) * h;
    const errorH = (b.errors / max) * h;
    return {
      x, w: bw,
      totalY: baselineY - totalH, totalH,
      errorY: baselineY - errorH, errorH,
    };
  });
  return { bars, baselineY, plotL: padL, plotR: padL + w, plotT: padT, plotB: baselineY };
}

export function timeToX(t: number, from: number, to: number, plotL: number, plotR: number): number {
  if (to <= from) return plotL;
  const frac = Math.min(1, Math.max(0, (t - from) / (to - from)));
  return plotL + frac * (plotR - plotL);
}

export function xToTime(x: number, from: number, to: number, plotL: number, plotR: number): number {
  if (plotR <= plotL) return from;
  const frac = Math.min(1, Math.max(0, (x - plotL) / (plotR - plotL)));
  return from + frac * (to - from);
}

/** Shrink (or grow) the window [from, to] by `factor`, keeping `pivot` at the same relative spot. */
export function zoomTowardPivot(
  pivot: number, from: number, to: number, factor: number,
): { from: number; to: number } {
  return { from: pivot - (pivot - from) * factor, to: pivot + (to - pivot) * factor };
}

export interface TimeAxisTick { x: number; label: string; anchor: 'start' | 'middle' | 'end'; }

const DAY_MS = 86_400_000;

/** Format an epoch-ms instant for a timeline axis tick, picking granularity from the window span. */
export function formatAxisTime(ms: number, spanMs: number): string {
  const d = new Date(ms);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (spanMs <= 2 * DAY_MS) return time;
  const date = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  if (spanMs <= 14 * DAY_MS) return `${date} ${time}`;
  return date;
}

/** Evenly-spaced time ticks across [from, to]; edge ticks anchor inward so labels never clip. */
export function timelineAxisTicks(
  from: number, to: number, plotL: number, plotR: number, count: number,
): TimeAxisTick[] {
  if (to <= from || plotR <= plotL || count < 2) return [];
  const span = to - from;
  return Array.from({ length: count }, (_, i) => {
    const frac = i / (count - 1);
    const anchor: TimeAxisTick['anchor'] = i === 0 ? 'start' : i === count - 1 ? 'end' : 'middle';
    return { x: plotL + frac * (plotR - plotL), label: formatAxisTime(from + frac * span, span), anchor };
  });
}
