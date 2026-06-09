// Pure constants, label maps, and derivations for the Dashboard.
// No JSX, no I/O — unit-tested in dashboardMeta.spec.ts.

import type {
  AgentBreakdownDto,
  AgentDto,
  LatencyStatDto,
  ModelBreakdownDto,
  AgentTokenUsageDto,
} from '../../api/models';
import { modelColor } from '../../lib/colors';
import { fmtTokens } from '../../lib/format';
import { rangeFrom, type RangeKey, type StatisticsBucket } from '../../lib/time-range';

export const RANGES: RangeKey[] = ['1h', '24h', '7d', '30d', 'all'];

// ── Telemetry formatter ──────────────────────────────────────────────────────

/** Returns '—' for missing values, otherwise formats numbers or returns strings. */
export function teleFmt(
  v: string | number | undefined | null,
  fmt?: (n: number) => string,
): string {
  if (v === undefined || v === null) return '—';
  if (typeof v === 'number' && fmt) return fmt(v);
  return String(v);
}

// ── Latency stats ────────────────────────────────────────────────────────────

export interface LatencyStats {
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  samples: number;
}

/** Compute weighted-average latency percentiles across all endpoint buckets. */
export function computeLatencyStats(data: LatencyStatDto[]): LatencyStats | null {
  if (data.length === 0) return null;
  const totalSamples = data.reduce((s, d) => s + d.sampleCount, 0);
  const total = totalSamples || 1;
  return {
    p50: Math.round(data.reduce((s, d) => s + d.p50Ms * d.sampleCount, 0) / total),
    p90: Math.round(data.reduce((s, d) => s + d.p95Ms * 0.85 * d.sampleCount, 0) / total),
    p95: Math.round(data.reduce((s, d) => s + d.p95Ms * d.sampleCount, 0) / total),
    p99: Math.round(data.reduce((s, d) => s + d.p99Ms * d.sampleCount, 0) / total),
    samples: totalSamples,
  };
}

// ── Token volume ─────────────────────────────────────────────────────────────

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
  if (sumByMs.size === 0) return { values: [], buckets: [] };

  const bucketMs = BUCKET_MS[bucket];
  // Reduce rather than `Math.min(...keys)` — spreading an untrusted-length key set risks a
  // call-stack RangeError. For a fixed window the lower bound is the window start.
  let earliest = Number.POSITIVE_INFINITY;
  for (const k of sumByMs.keys()) if (k < earliest) earliest = k;
  const lowerMs = range === 'all' ? earliest : Date.parse(rangeFrom(range));
  const endMs = alignDown(Date.now(), bucketMs);
  let startMs = alignDown(lowerMs, bucketMs);
  if ((endMs - startMs) / bucketMs + 1 > MAX_BUCKETS) startMs = endMs - (MAX_BUCKETS - 1) * bucketMs;
  // Guarantee at least two points so the area chart renders — e.g. the all-time view when every
  // trace falls in a single bucket would otherwise collapse to one point and show the empty state.
  startMs = Math.min(startMs, endMs - bucketMs);

  return fillTokenGrid(sumByMs, startMs, endMs, bucketMs);
}

// ── Model split ──────────────────────────────────────────────────────────────

export interface ModelSplit {
  models: { name: string; tokens: number }[];
  total: number;
}

/** Top-3 models by token count with total for computing proportions. */
export function computeModelSplit(breakdown: ModelBreakdownDto[]): ModelSplit {
  const sorted = [...breakdown]
    .map(m => ({ name: m.modelName, tokens: m.totalInputTokens + m.totalOutputTokens }))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 3);
  const total = sorted.reduce((s, m) => s + m.tokens, 0) || 1;
  return { models: sorted, total };
}

// ── Latency histogram ────────────────────────────────────────────────────────

/** Bucket latency data into 10 histogram buckets (500 ms each). */
export function computeLatencyHist(data: LatencyStatDto[]): number[] {
  if (data.length === 0) return [];
  const buckets = new Array(10).fill(0) as number[];
  for (const d of data) {
    const idx = Math.min(9, Math.max(0, Math.round(d.p95Ms / 500)));
    buckets[idx] += d.sampleCount;
  }
  return buckets;
}

// ── Token usage by agent (share) ────────────────────────────────────────────

export interface AgentTokenShare {
  id: string;
  name: string;
  tokens: number;
  inputTokens: number;
  outputTokens: number;
  /** Fraction of the grand total (0–1). */
  share: number;
}

export interface TokenAgentShare {
  agents: AgentTokenShare[];
  total: number;
}

/**
 * Aggregate per-agent token rows into totals sorted by usage (desc), excluding
 * system agents. Powers the donut + legend on the dashboard.
 */
export function computeTokenAgentShare(rawData: AgentTokenUsageDto[], agents: AgentDto[]): TokenAgentShare {
  const systemIds = new Set(agents.filter(a => a.isSystemAgent).map(a => a.id));
  const nameById = new Map(agents.map(a => [a.id, a.name]));

  const acc = new Map<string, { input: number; output: number }>();
  for (const r of rawData) {
    if (systemIds.has(r.agentId)) continue;
    const cur = acc.get(r.agentId) ?? { input: 0, output: 0 };
    cur.input += r.inputTokens;
    cur.output += r.outputTokens;
    acc.set(r.agentId, cur);
  }

  const list: AgentTokenShare[] = [...acc.entries()].map(([id, v]) => ({
    id,
    name: nameById.get(id) ?? id.slice(0, 6),
    tokens: v.input + v.output,
    inputTokens: v.input,
    outputTokens: v.output,
    share: 0,
  }));
  const total = list.reduce((n, a) => n + a.tokens, 0);
  for (const a of list) a.share = total > 0 ? a.tokens / total : 0;
  list.sort((a, b) => b.tokens - a.tokens);

  return { agents: list, total };
}

// ── Agent name map ───────────────────────────────────────────────────────────

/** Build a stable id→name lookup from the agent list. */
export function buildAgentNameMap(agents: AgentDto[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const a of agents) m.set(a.id, a.name);
  return m;
}

// ── Trace count per agent ────────────────────────────────────────────────────

/** Look up call count for a specific agent from the breakdown list. */
export function agentCallCount(breakdown: AgentBreakdownDto[], agentId: string): number {
  return breakdown.find(b => b.agentId === agentId)?.callCount ?? 0;
}

// ── Token number splitting ───────────────────────────────────────────────────

export interface TokenDisplay {
  num: string;
  suffix: string;
}

/** Split a formatted token string like "1.2M" into number and suffix parts. */
export function splitTokenStr(totalTokens: number): TokenDisplay {
  const s = fmtTokens(totalTokens);
  const match = s.match(/^([\d.,]+)(\D*)$/);
  return { num: match?.[1] ?? s, suffix: match?.[2] ?? '' };
}

// ── Model bar color ──────────────────────────────────────────────────────────

/** Runtime color for model split bar — data-driven, kept here so it is not inline. */
export { modelColor };
