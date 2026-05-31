/**
 * Pure coordinate math for {@link ./ChartArtifact}. Keeps the component free of layout arithmetic.
 * All charts share a fixed viewBox and a zero-anchored value scale (so bar/area heights are honest).
 */

export const CHART_W = 560;
export const CHART_H = 240;
const PAD = { left: 42, right: 16, top: 18, bottom: 30 };

export const INNER_W = CHART_W - PAD.left - PAD.right;
export const INNER_H = CHART_H - PAD.top - PAD.bottom;
export const PAD_LEFT = PAD.left;
export const PAD_TOP = PAD.top;

export interface Scale {
  domainMin: number;
  domainMax: number;
  /** Horizontal centre of category `i` (bars, points, x-labels all align to this). */
  xCenter: (i: number) => number;
  /** Vertical pixel for a data value. */
  y: (v: number) => number;
  /** Pixel of the value baseline (where bars/area anchor). */
  baselineY: number;
  /** Per-category horizontal slot width. */
  slot: (n: number) => number;
}

export function buildScale(values: number[]): Scale {
  const domainMax = Math.max(...values, 0) || 1;
  const domainMin = Math.min(...values, 0);
  const range = domainMax - domainMin || 1;
  const y = (v: number) => PAD.top + INNER_H - ((v - domainMin) / range) * INNER_H;
  return {
    domainMin,
    domainMax,
    y,
    baselineY: y(Math.max(domainMin, 0)),
    xCenter: (i: number) => PAD.left + ((i + 0.5) / Math.max(values.length, 1)) * INNER_W,
    slot: (n: number) => INNER_W / Math.max(n, 1),
  };
}

export interface Tick {
  value: number;
  y: number;
}

/** Evenly spaced horizontal gridlines spanning the value domain (inclusive of both ends). */
export function ticks(scale: Scale, count = 4): Tick[] {
  const { domainMin, domainMax } = scale;
  return Array.from({ length: count + 1 }, (_, i) => {
    const value = domainMin + ((domainMax - domainMin) * i) / count;
    return { value, y: scale.y(value) };
  });
}

export function formatNum(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${Math.round(n * 100) / 100}`;
}
