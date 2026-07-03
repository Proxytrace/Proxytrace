export interface GridLine { y: number; val: string; isDashed: boolean; }
export interface AreaPoint { x: number; y: number; v: number; }
export interface AreaChartData {
  linePath: string; areaPath: string;
  solidGridPath: string; dashedGridPath: string;
  grid: GridLine[];
  xLabels: { x: number; label: string }[];
  endX: number; endY: number;
  pts: AreaPoint[];
  plotL: number; plotR: number; plotT: number; plotB: number;
}
export interface SparklineData { path: string; endX: number; endY: number; }
export interface HistRect { x: number; y: number; w: number; h: number; label: string; labelX: number; value: number; fullLabel: string; }
export interface HistData { rects: HistRect[]; barsPath: string; baselineY: number; }

export function computeSparkline(data: number[], width: number, height: number): SparklineData {
  if (data.length < 2) return { path: '', endX: 0, endY: 0 };
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const pts = data.map((v, i) => [i * stepX, height - ((v - min) / range) * height]);
  const path = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return { path, endX: pts[pts.length - 1][0], endY: pts[pts.length - 1][1] };
}

export function buildGridPaths(grid: GridLine[], x1: number, x2: number) {
  const solid = grid.filter(g => !g.isDashed).map(g => `M ${x1} ${g.y.toFixed(1)} L ${x2} ${g.y.toFixed(1)}`).join(' ');
  const dashed = grid.filter(g => g.isDashed).map(g => `M ${x1} ${g.y.toFixed(1)} L ${x2} ${g.y.toFixed(1)}`).join(' ');
  return { solidGridPath: solid, dashedGridPath: dashed };
}

export function computeAreaChart(
  data: number[], width: number, height: number,
  padL: number, padR: number, padT: number, padB: number,
  showAxis: boolean,
  xLabelFn?: (i: number, n: number) => string | null,
): AreaChartData {
  if (data.length < 2) {
    return {
      linePath: '', areaPath: '',
      solidGridPath: '', dashedGridPath: '',
      grid: [], xLabels: [], endX: 0, endY: 0,
      pts: [], plotL: padL, plotR: width - padR, plotT: padT, plotB: height - padB,
    };
  }
  const w = width - padL - padR, h = height - padT - padB;
  const max = Math.max(...data) * 1.15 || 1;
  const stepX = w / (data.length - 1);
  const pts = data.map((v, i) => [padL + i * stepX, padT + h - (v / max) * h]);
  const ptsTyped: AreaPoint[] = data.map((v, i) => ({ x: pts[i][0], y: pts[i][1], v }));
  const linePts = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const areaPath = `${linePts} L ${(padL + w).toFixed(1)} ${(padT + h).toFixed(1)} L ${padL} ${(padT + h).toFixed(1)} Z`;
  const yTicks = 4;
  const grid: GridLine[] = showAxis ? Array.from({ length: yTicks }, (_, i) => ({
    y: padT + (i / (yTicks - 1)) * h,
    val: String(Math.round(max * (1 - i / (yTicks - 1)))),
    isDashed: i !== yTicks - 1,
  })) : [];
  const xLabels: { x: number; label: string }[] = [];
  if (showAxis) {
    if (xLabelFn) {
      for (let i = 0; i < data.length; i++) {
        const lbl = xLabelFn(i, data.length);
        if (lbl !== null) xLabels.push({ x: padL + i * stepX, label: lbl });
      }
    } else {
      [0, 6, 12, 18, 23].forEach(i => xLabels.push({ x: padL + i * stepX, label: `${24 - i}h` }));
    }
  }
  const { solidGridPath, dashedGridPath } = buildGridPaths(grid, padL, padL + w);
  return {
    linePath: linePts, areaPath, solidGridPath, dashedGridPath, grid, xLabels,
    endX: pts[pts.length - 1][0], endY: pts[pts.length - 1][1],
    pts: ptsTyped,
    plotL: padL, plotR: padL + w, plotT: padT, plotB: padT + h,
  };
}

export function computeHistogram(
  data: number[],
  width: number,
  height: number,
  labels?: string[],
): HistData {
  const padL = 38, padR = 10, padT = 10, padB = 24;
  const w = width - padL - padR, h = height - padT - padB;
  const max = Math.max(...data, 0) * 1.1 || 1;
  const bw = w / data.length * 0.86, gap = w / data.length * 0.14;
  const fallback = ['0', '.5s', '1s', '1.5s', '2s', '2.5s', '3s', '3.5s', '4s', '5s+'];
  const lab = labels ?? fallback;
  const rects: HistRect[] = data.map((v, i) => ({
    x: padL + i * (bw + gap) + gap / 2, w: bw,
    y: padT + h - (v / max) * h, h: (v / max) * h,
    label: lab[i] ?? '', labelX: padL + i * (bw + gap) + gap / 2 + bw / 2,
    value: v, fullLabel: lab[i] ?? '',
  }));
  const barsPath = rects.map(r =>
    `M ${r.x.toFixed(1)} ${r.y.toFixed(1)} h ${r.w.toFixed(1)} v ${r.h.toFixed(1)} h -${r.w.toFixed(1)} Z`
  ).join(' ');
  return { rects, barsPath, baselineY: padT + h };
}

export interface StackedSegment { value: number; color: string; label?: string; }
export interface StackedDatum { label: string; segments: StackedSegment[]; }
export interface StackedRect { x: number; y: number; w: number; h: number; color: string; top: boolean; value: number; label: string; }
export interface StackedBar { rects: StackedRect[]; centerX: number; label: string; total: number; }
export interface StackedBarData { bars: StackedBar[]; grid: GridLine[]; solidGridPath: string; dashedGridPath: string; baselineY: number; plotL: number; plotR: number; labelStep: number; }

/** Approximate mono axis-label glyph width at font-size 10. */
const AXIS_CHAR_PX = 6;
/** Minimum clear space between two adjacent axis labels. */
const AXIS_LABEL_GAP_PX = 10;

/**
 * Every how-many bars an x-axis label fits without colliding with its neighbor: the longest label's
 * estimated width (plus a gap) must fit in `step` bar slots. Always ≥ 1.
 */
export function axisLabelStep(slotWidth: number, labels: readonly string[]): number {
  const maxLen = labels.reduce((m, l) => Math.max(m, l.length), 0);
  const needed = maxLen * AXIS_CHAR_PX + AXIS_LABEL_GAP_PX;
  if (slotWidth <= 0) return 1;
  return Math.max(1, Math.ceil(needed / slotWidth));
}

/**
 * @param formatTick optional axis-tick formatter (receives the raw tick value). Defaults to the
 * `k`-suffixed thousands format used by the token chart; small-integer series (e.g. anomaly counts)
 * pass a plain-integer formatter so the axis reads `0/1/2/3` instead of a flat `0k`.
 * @param integerTicks snap the axis max so all four tick values are whole numbers — for count
 * series, where fractional ticks would round to duplicate labels (`2/1/1/0`).
 */
export function computeStackedBar(
  data: StackedDatum[], width: number, height: number,
  formatTick?: (v: number) => string,
  integerTicks = false,
): StackedBarData {
  const padL = 38, padR = 10, padT = 14, padB = 28;
  const w = width - padL - padR, h = height - padT - padB;
  const totals = data.map(d => d.segments.reduce((s, x) => s + x.value, 0));
  const rawMax = Math.max(...totals, 0);
  // Integer axes round the 10%-headroom max up to a multiple of 3 so the quarter ticks are whole.
  const max = integerTicks ? Math.max(3, Math.ceil((rawMax * 1.1) / 3) * 3) : rawMax * 1.1 || 1;
  const slot = data.length > 0 ? w / data.length : w;
  const bw = slot * 0.58, gap = slot * 0.42;
  const yTicks = 4;
  const fmtTick = formatTick ?? ((v: number) => String(Math.round(v / 1000)) + 'k');
  const grid: GridLine[] = Array.from({ length: yTicks }, (_, i) => ({
    y: padT + (i / (yTicks - 1)) * h,
    val: fmtTick(max * (1 - i / (yTicks - 1))),
    isDashed: i !== yTicks - 1,
  }));
  const bars: StackedBar[] = data.map((d, i) => {
    const x = padL + i * (bw + gap) + gap / 2;
    let cursor = padT + h;
    const positive = d.segments.filter(s => s.value > 0);
    const rects: StackedRect[] = positive.map((seg, j) => {
      const segH = (seg.value / max) * h;
      const y = cursor - segH;
      cursor = y;
      return { x, y, w: bw, h: Math.max(segH, 0), color: seg.color, top: j === positive.length - 1, value: seg.value, label: seg.label ?? d.label };
    });
    return { rects, centerX: x + bw / 2, label: d.label, total: totals[i] };
  });
  const { solidGridPath, dashedGridPath } = buildGridPaths(grid, padL, padL + w);
  const labelStep = axisLabelStep(slot, data.map(d => d.label));
  return { bars, grid, solidGridPath, dashedGridPath, baselineY: padT + h, plotL: padL, plotR: padL + w, labelStep };
}

/** Path for a rect with only its top two corners rounded. */
export function roundedTopRectPath(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0) return '';
  const rr = Math.min(r, h, w / 2);
  return `M ${x.toFixed(1)} ${(y + h).toFixed(1)} L ${x.toFixed(1)} ${(y + rr).toFixed(1)} Q ${x.toFixed(1)} ${y.toFixed(1)} ${(x + rr).toFixed(1)} ${y.toFixed(1)} L ${(x + w - rr).toFixed(1)} ${y.toFixed(1)} Q ${(x + w).toFixed(1)} ${y.toFixed(1)} ${(x + w).toFixed(1)} ${(y + rr).toFixed(1)} L ${(x + w).toFixed(1)} ${(y + h).toFixed(1)} Z`;
}

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

export interface GaugeSegment { x1: number; y1: number; x2: number; y2: number; color: string; active: boolean; glow: boolean; }
export interface SegmentedGaugeData { segments: GaugeSegment[]; cx: number; cy: number; }

export function computeSegmentedGauge(value: number, size: number): SegmentedGaugeData {
  const SEGS = 44;
  const filled = Math.round((value / 100) * SEGS);
  const s = size / 220;
  const r = size / 2 - 16 * s - 6;
  const cx = size / 2, cy = size / 2;
  const startAngle = -210, endAngle = 30;
  const range = endAngle - startAngle;
  const armLen = 7 * s + 1;
  const segments: GaugeSegment[] = Array.from({ length: SEGS }, (_, i) => {
    const t = i / (SEGS - 1);
    const ang = (startAngle + t * range) * Math.PI / 180;
    const active = i < filled;
    const color = t < 0.35 ? 'var(--warn)' : t < 0.7 ? 'var(--accent-primary)' : 'var(--success)';
    return {
      x1: cx + Math.cos(ang) * (r - armLen), y1: cy + Math.sin(ang) * (r - armLen),
      x2: cx + Math.cos(ang) * (r + armLen), y2: cy + Math.sin(ang) * (r + armLen),
      color, active, glow: active && i > filled - 4,
    };
  });
  return { segments, cx, cy };
}

export function computeModelBars(
  data: { label: string; value: number }[],
  width: number,
  height: number,
  truncateAt = 10,
): HistData {
  if (data.length === 0) return { rects: [], barsPath: '', baselineY: height - 36 };
  const padL = 38, padR = 10, padT = 10, padB = 36;
  const w = width - padL - padR, h = height - padT - padB;
  const max = Math.max(...data.map(d => d.value)) * 1.1 || 1;
  const bw = w / data.length * 0.7, gap = w / data.length * 0.3;
  const rects: HistRect[] = data.map((d, i) => ({
    x: padL + i * (bw + gap) + gap / 2, w: bw,
    y: padT + h - (d.value / max) * h, h: (d.value / max) * h,
    label: d.label.length > truncateAt ? d.label.slice(0, truncateAt - 1) + '…' : d.label,
    labelX: padL + i * (bw + gap) + gap / 2 + bw / 2,
    value: d.value, fullLabel: d.label,
  }));
  const barsPath = rects.map(r =>
    `M ${r.x.toFixed(1)} ${r.y.toFixed(1)} h ${r.w.toFixed(1)} v ${r.h.toFixed(1)} h -${r.w.toFixed(1)} Z`
  ).join(' ');
  return { rects, barsPath, baselineY: padT + h };
}
