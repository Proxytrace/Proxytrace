import { type GridLine, buildGridPaths, axisLabelStep } from './chart-scale';
import { BAR_PAD_L, BAR_PAD_R, barBand } from './chart-bars';

export interface StackedSegment { value: number; color: string; label?: string; }
export interface StackedDatum { label: string; segments: StackedSegment[]; }
export interface StackedRect { x: number; y: number; w: number; h: number; color: string; top: boolean; value: number; label: string; }
export interface StackedBar { rects: StackedRect[]; centerX: number; label: string; total: number; }
export interface StackedBarData { bars: StackedBar[]; grid: GridLine[]; solidGridPath: string; dashedGridPath: string; baselineY: number; plotL: number; plotR: number; labelStep: number; }

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
  const padL = BAR_PAD_L, padR = BAR_PAD_R, padT = 14, padB = 28;
  const w = width - padL - padR, h = height - padT - padB;
  const totals = data.map(d => d.segments.reduce((s, x) => s + x.value, 0));
  const rawMax = Math.max(...totals, 0);
  // Integer axes round the 10%-headroom max up to a multiple of 3 so the quarter ticks are whole.
  const max = integerTicks ? Math.max(3, Math.ceil((rawMax * 1.1) / 3) * 3) : rawMax * 1.1 || 1;
  const { slot, bw, x: barX } = barBand(w, data.length, padL, 0.58, 0.42);
  const yTicks = 4;
  const fmtTick = formatTick ?? ((v: number) => String(Math.round(v / 1000)) + 'k');
  const grid: GridLine[] = Array.from({ length: yTicks }, (_, i) => ({
    y: padT + (i / (yTicks - 1)) * h,
    val: fmtTick(max * (1 - i / (yTicks - 1))),
    isDashed: i !== yTicks - 1,
  }));
  const bars: StackedBar[] = data.map((d, i) => {
    const x = barX(i);
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
