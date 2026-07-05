export interface GridLine { y: number; val: string; isDashed: boolean; }

export function buildGridPaths(grid: GridLine[], x1: number, x2: number) {
  const solid = grid.filter(g => !g.isDashed).map(g => `M ${x1} ${g.y.toFixed(1)} L ${x2} ${g.y.toFixed(1)}`).join(' ');
  const dashed = grid.filter(g => g.isDashed).map(g => `M ${x1} ${g.y.toFixed(1)} L ${x2} ${g.y.toFixed(1)}`).join(' ');
  return { solidGridPath: solid, dashedGridPath: dashed };
}

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
 * Position of a value on a shared log scale spanning `[lo … hi]`, as a 0–1 fraction
 * (clamped). Log-scaled so a single large outlier doesn't crush the other markers into
 * the left edge; values below 1 clamp to 1 to keep the log defined. Powers the
 * dashboard's latency-spectrum span bars.
 */
export function logSpanPos(v: number, lo: number, hi: number): number {
  const l = Math.log(Math.max(1, lo));
  const h = Math.log(Math.max(Math.max(1, lo) * Math.E, hi));
  const x = (Math.log(Math.max(1, v)) - l) / (h - l);
  return Math.min(1, Math.max(0, x));
}
