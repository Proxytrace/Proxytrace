// Trend-delta derivations for the Dashboard stat tiles and pass-rate gauge.
// No JSX, no I/O — unit-tested in dashboardMeta.spec.ts (via the dashboardMeta barrel).
//
// The dashboard already fetches the `DashboardTrendsDto` series that drive the tile sparklines;
// these helpers turn them into the honest delta chips shown on the tiles and gauge, so no number
// on the dashboard is a hardcoded placeholder:
//   - traces / latencyMs / throughput — 20 fixed time buckets over the window, oldest → newest,
//     with an empty bucket reported as 0 (no calls captured in that slice).
//   - passRate — one point per recent test-run cohort (0–100), oldest → newest, real runs only.

export interface TrendDelta {
  /** Signed, display-ready magnitude, e.g. "+24%" or "-7pt" — the tile chip renders it verbatim. */
  text: string;
  /** True when the metric rose across the window — drives the ▲/success vs ▼/danger chip. */
  up: boolean;
}

/** Mean of the positive entries, or null when none are positive. */
function positiveMean(values: number[]): number | null {
  const active = values.filter(v => v > 0);
  if (active.length === 0) return null;
  return active.reduce((sum, v) => sum + v, 0) / active.length;
}

/** Plain mean of the entries, or null when empty. */
function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Percentage change between the first and last half of a bucketed call-metric series
 * (traces / latency / throughput). Empty buckets (0 — no calls in that slice) are ignored, so an
 * idle stretch neither divides by zero nor drags a latency average toward 0. Returns null when
 * either half has no active bucket — the tile then renders no chip rather than a fabricated one.
 */
export function callSeriesDelta(values: number[]): TrendDelta | null {
  const mid = Math.floor(values.length / 2);
  const first = positiveMean(values.slice(0, mid));
  const last = positiveMean(values.slice(mid));
  if (first === null || last === null) return null;
  const pct = Math.round(((last - first) / first) * 100);
  return { text: `${pct >= 0 ? '+' : ''}${pct}%`, up: pct >= 0 };
}

/**
 * Percentage-point change between the first and last half of the recent test-run pass-rate series
 * (each point a real run cohort, 0–100 — a 0% run is a valid data point, so no entry is dropped).
 * Returns null when there are fewer than two cohorts.
 */
export function passRateDelta(values: number[]): TrendDelta | null {
  const mid = Math.floor(values.length / 2);
  const first = mean(values.slice(0, mid));
  const last = mean(values.slice(mid));
  if (first === null || last === null) return null;
  const pt = Math.round(last - first);
  return { text: `${pt >= 0 ? '+' : ''}${pt}pt`, up: pt >= 0 };
}

/** Formats a percentage-point delta for display, e.g. 7 → "+7pt", -3 → "-3pt". */
export function formatDeltaPt(pt: number): string {
  return `${pt >= 0 ? '+' : ''}${pt}pt`;
}

export interface PassRateGaugeStats {
  /** Points change of the most recent run cohort vs the previous one, or null when < 2 cohorts. */
  lastRunDeltaPt: number | null;
  /** Best (highest) pass rate across the recent run cohorts, 0–100. */
  best: number;
}

/**
 * Gauge footer stats from the recent test-run pass-rate cohorts (oldest → newest, 0–100). Returns
 * null when there are no cohorts — the gauge then drops its footer entirely rather than inventing
 * a value.
 */
export function computePassRateGaugeStats(passRate: number[]): PassRateGaugeStats | null {
  if (passRate.length === 0) return null;
  const best = Math.max(...passRate);
  const latest = passRate[passRate.length - 1];
  const prev = passRate.length >= 2 ? passRate[passRate.length - 2] : undefined;
  const lastRunDeltaPt = latest !== undefined && prev !== undefined ? Math.round(latest - prev) : null;
  return { lastRunDeltaPt, best };
}
