// Shared bar-chart geometry for the categorical bar charts (histogram, model bars, stacked
// bars). These charts share the same plot padding, per-bar slot layout, and square-bar path
// building; this module is the single source for that geometry. It is intentionally NOT
// re-exported through the `chart-math` barrel — it is an internal helper for the sibling
// compute modules, keeping the public math surface unchanged.

/** Left plot padding (y-axis label gutter) shared by the categorical bar charts. */
export const BAR_PAD_L = 38;
/** Right plot padding shared by the categorical bar charts. */
export const BAR_PAD_R = 10;

export interface BarRect { x: number; y: number; w: number; h: number; }

export interface BarBand {
  /** Full per-category slot width (`w / n`, or `w` when `n` is 0). */
  slot: number;
  /** Bar width. */
  bw: number;
  /** Gutter width between adjacent bars. */
  gap: number;
  /** Left x of bar `i`. */
  x: (i: number) => number;
}

/**
 * Per-bar horizontal geometry for a categorical bar chart: each of `n` categories owns an equal
 * slot of the plot width `w`; the bar fills `barFrac` of its slot and the remaining `gapFrac`
 * is the gutter (`barFrac + gapFrac` is 1). Bars are centered in their slot via a half-gutter
 * offset. `padL` is the left plot padding the bars start after.
 */
export function barBand(w: number, n: number, padL: number, barFrac: number, gapFrac: number): BarBand {
  const slot = n > 0 ? w / n : w;
  const bw = slot * barFrac;
  const gap = slot * gapFrac;
  return { slot, bw, gap, x: (i: number) => padL + i * (bw + gap) + gap / 2 };
}

/** SVG path for a set of plain, square-cornered bars (top-left, clockwise). */
export function barsRectPath(rects: readonly BarRect[]): string {
  return rects
    .map(r => `M ${r.x.toFixed(1)} ${r.y.toFixed(1)} h ${r.w.toFixed(1)} v ${r.h.toFixed(1)} h -${r.w.toFixed(1)} Z`)
    .join(' ');
}
