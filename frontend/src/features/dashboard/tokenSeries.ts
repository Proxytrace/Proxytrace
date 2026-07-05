// Token-volume time-series derivations for the Dashboard.
// No JSX, no I/O — unit-tested in dashboardMeta.spec.ts (via the dashboardMeta barrel).

import { rangeFrom, type RangeKey, type StatisticsBucket } from '../../lib/time-range';

export interface TokenSeries {
  /** Per-bucket token totals, chronological. */
  values: number[];
  /** Bucket-start ISO timestamps, aligned 1:1 with `values` (powers the time axis). */
  buckets: string[];
}

/** Bucket width in milliseconds. Buckets are UTC-aligned (backend truncates against UTC). */
const BUCKET_MS: Record<StatisticsBucket, number> = {
  fiveMinutes: 5 * 60_000,
  hourly: 60 * 60_000,
  daily: 24 * 60 * 60_000,
};

/** Cap on grid length so an unbounded all-time window can't emit thousands of points. */
const MAX_BUCKETS = 720;

/** Floor an epoch-ms to its UTC bucket boundary (epoch 0 is a UTC midnight, so modulo aligns). */
function alignDown(ms: number, bucketMs: number): number {
  return ms - (((ms % bucketMs) + bucketMs) % bucketMs);
}

export interface TokenGridBounds {
  startMs: number;
  endMs: number;
  bucketMs: number;
}

/**
 * Resolve the uniform bucket-grid bounds for a token series: `[window start … now]`, or
 * `[earliest bucket … now]` for the all-time view, capped at {@link MAX_BUCKETS} and padded
 * to at least two buckets so area/sparkline charts always have a line to draw. Returns null
 * when there are no data buckets at all.
 */
export function tokenGridBounds(keys: Iterable<number>, range: RangeKey, bucket: StatisticsBucket): TokenGridBounds | null {
  const bucketMs = BUCKET_MS[bucket];
  // Reduce rather than `Math.min(...keys)` — spreading an untrusted-length key set risks a
  // call-stack RangeError. For a fixed window the lower bound is the window start.
  let earliest = Number.POSITIVE_INFINITY;
  for (const k of keys) if (k < earliest) earliest = k;
  if (earliest === Number.POSITIVE_INFINITY) return null;
  const lowerMs = range === 'all' ? earliest : Date.parse(rangeFrom(range));
  const endMs = alignDown(Date.now(), bucketMs);
  let startMs = alignDown(lowerMs, bucketMs);
  if ((endMs - startMs) / bucketMs + 1 > MAX_BUCKETS) startMs = endMs - (MAX_BUCKETS - 1) * bucketMs;
  startMs = Math.min(startMs, endMs - bucketMs);
  return { startMs, endMs, bucketMs };
}

/**
 * Fill a uniform bucket grid from `startMs` to `endMs` (inclusive, step `bucketMs`), reading
 * per-bucket totals from `sumByMs` and substituting 0 for missing buckets. Pure + deterministic.
 */
export function fillTokenGrid(sumByMs: Map<number, number>, startMs: number, endMs: number, bucketMs: number): TokenSeries {
  const values: number[] = [];
  const buckets: string[] = [];
  for (let t = startMs; t <= endMs; t += bucketMs) {
    values.push(sumByMs.get(t) ?? 0);
    buckets.push(new Date(t).toISOString());
  }
  return { values, buckets };
}

/**
 * Aggregate token usage into a *dense*, uniformly-spaced time series for the selected range.
 *
 * The backend only emits buckets that have traffic, so plotting those rows by index would draw
 * unequal time gaps as equal steps and shrink the x-axis to the data extent. We gap-fill a uniform
 * UTC bucket grid spanning the whole window — `[rangeFrom(range) … now]`, or `[first bucket … now]`
 * for the all-time view — so spacing reflects real time and the axis covers the full window.
 *
 * `bucket` is the backend-resolved granularity (the all-time view sizes it from the data span), so
 * the grid steps must match it exactly or the gap-fill keys won't line up with the returned rows.
 */
export function computeTokenSeries(
  data: { bucketStart: string; inputTokens: number; outputTokens: number }[],
  range: RangeKey,
  bucket: StatisticsBucket,
): TokenSeries {
  const sumByMs = new Map<number, number>();
  for (const r of data) {
    const ms = Date.parse(r.bucketStart);
    if (Number.isNaN(ms)) continue;
    sumByMs.set(ms, (sumByMs.get(ms) ?? 0) + r.inputTokens + r.outputTokens);
  }
  const bounds = tokenGridBounds(sumByMs.keys(), range, bucket);
  if (!bounds) return { values: [], buckets: [] };
  return fillTokenGrid(sumByMs, bounds.startMs, bounds.endMs, bounds.bucketMs);
}
