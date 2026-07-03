import type { AgentAnomalyStatDto } from '../../api/models';
import type { StackedDatum } from '../../components/charts/chart-math';
import { bucketAxisLabel, type StatisticsBucket } from '../../lib/time-range';
import { resolveRange, type TimeRange } from '../../lib/timeRange';

/**
 * Pure series math for the anomaly-dashboard timeline. Everything here is framework-free and
 * unit-tested (`anomaliesMeta.spec.ts`): the sparse→dense bucketing, the StackedBar adapter, the
 * per-agent ranking, and the window resolution the timeline query needs.
 *
 * The API returns a **sparse** series (only non-empty `(bucket, agent)` cells). The plot needs a
 * **dense** bucket axis so empty buckets read as gaps, not as a compressed timeline — so we generate
 * the full UTC-aligned bucket grid from the query window and fold the sparse rows into it.
 */

const BUCKET_MS: Record<StatisticsBucket, number> = {
  fiveMinutes: 5 * 60_000,
  hourly: 60 * 60_000,
  daily: 24 * 60 * 60_000,
};

/** Hard cap on rendered bars — a wide window at a fine bucket would otherwise produce thousands of
 * unreadable bars. When exceeded we keep the most recent {@link MAX_BUCKETS} and flag it. */
export const MAX_BUCKETS = 400;

export interface AnomalyCell {
  agentId: string;
  staticCount: number;
  customCount: number;
  total: number;
}

export interface DenseBucket {
  startMs: number;
  iso: string;
  cells: AnomalyCell[];
  total: number;
}

export interface DenseTimeline {
  buckets: DenseBucket[];
  /** True when older buckets were dropped to respect {@link MAX_BUCKETS}. */
  truncated: boolean;
}

/**
 * The concrete `from`/`to` the timeline query needs (both required by the API). `to` is the range's
 * upper bound or *now*; `from` is the range's lower bound, falling back to a trailing 30-day window
 * for open-ended ranges ("all time" / no lower bound) so the plot always has a bounded axis.
 */
export function resolveTimelineWindow(range: TimeRange, nowMs: number = Date.now()): { from: string; to: string } {
  const resolved = resolveRange(range, nowMs);
  const to = range.kind === 'absolute' && range.to ? range.to : new Date(nowMs).toISOString();
  const from = resolved.from ?? new Date(nowMs - 30 * BUCKET_MS.daily).toISOString();
  return { from, to };
}

/**
 * {@link resolveTimelineWindow} with *now* quantized to the end of the current bucket
 * (`floor(now) + step − 1`), so relative ranges resolve to the **same** `from`/`to` strings for the
 * whole bucket instead of drifting with the clock on every render. The drift changed the TanStack
 * query key each render and put the timeline in a perpetual refetch loop; quantizing keeps the key
 * stable within a bucket while still rolling the window forward at each bucket boundary. The
 * quantized instant stays inside the current bucket, so the dense grid gains no empty future bucket.
 */
export function quantizedTimelineWindow(
  range: TimeRange,
  bucket: StatisticsBucket,
  nowMs: number = Date.now(),
): { from: string; to: string } {
  const step = BUCKET_MS[bucket];
  return resolveTimelineWindow(range, floorToBucket(nowMs, step) + step - 1);
}

/** Floors an epoch-ms instant to its UTC-aligned bucket boundary. Epoch 0 is UTC midnight and every
 * bucket size divides evenly into a day, so a single floor-to-multiple works for all granularities. */
function floorToBucket(ms: number, stepMs: number): number {
  return Math.floor(ms / stepMs) * stepMs;
}

/**
 * Folds the sparse API rows into a dense, UTC-aligned bucket grid spanning `[from, to]`. Rows are
 * matched to buckets by epoch (not string) so backend/JS ISO-format differences never misalign.
 */
export function buildDenseTimeline(
  rows: readonly AgentAnomalyStatDto[],
  from: string,
  to: string,
  bucket: StatisticsBucket,
): DenseTimeline {
  const step = BUCKET_MS[bucket];
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  if (Number.isNaN(fromMs) || Number.isNaN(toMs) || toMs <= fromMs) {
    return { buckets: [], truncated: false };
  }

  // Sparse rows folded into per-bucket, per-agent cells keyed by bucket-start epoch.
  const byBucket = new Map<number, Map<string, AnomalyCell>>();
  for (const row of rows) {
    const startMs = floorToBucket(Date.parse(row.bucketStart), step);
    if (Number.isNaN(startMs)) continue;
    let agents = byBucket.get(startMs);
    if (!agents) { agents = new Map(); byBucket.set(startMs, agents); }
    const existing = agents.get(row.agentId);
    const staticCount = (existing?.staticCount ?? 0) + row.staticCount;
    const customCount = (existing?.customCount ?? 0) + row.customCount;
    agents.set(row.agentId, { agentId: row.agentId, staticCount, customCount, total: staticCount + customCount });
  }

  const firstStart = floorToBucket(fromMs, step);
  const buckets: DenseBucket[] = [];
  for (let startMs = firstStart; startMs < toMs; startMs += step) {
    const cells = [...(byBucket.get(startMs)?.values() ?? [])].sort((a, b) => a.agentId.localeCompare(b.agentId));
    buckets.push({
      startMs,
      iso: new Date(startMs).toISOString(),
      cells,
      total: cells.reduce((s, c) => s + c.total, 0),
    });
  }

  const truncated = buckets.length > MAX_BUCKETS;
  return { buckets: truncated ? buckets.slice(buckets.length - MAX_BUCKETS) : buckets, truncated };
}

/** Adapts dense buckets to the {@link StackedBar} input: one datum per bucket, one segment per agent
 * (colored by the caller), the segment label carrying the per-agent static/custom split for the tooltip. */
export function toStackedData(
  buckets: readonly DenseBucket[],
  bucket: StatisticsBucket,
  resolve: { color: (agentId: string) => string; segmentLabel: (cell: AnomalyCell) => string },
): StackedDatum[] {
  return buckets.map(b => ({
    label: bucketAxisLabel(b.iso, bucket),
    segments: b.cells.map(cell => ({
      value: cell.total,
      color: resolve.color(cell.agentId),
      label: resolve.segmentLabel(cell),
    })),
  }));
}

export interface AgentRank {
  agentId: string;
  total: number;
  staticTotal: number;
  customTotal: number;
}

/** Per-agent flagged-call totals over the whole window, ranked most-flagged first. Operates on the
 * sparse rows directly (no need for the dense grid) — answers "which agent needs help most". */
export function rankAgents(rows: readonly AgentAnomalyStatDto[], limit = 5): AgentRank[] {
  const byAgent = new Map<string, AgentRank>();
  for (const row of rows) {
    const cur = byAgent.get(row.agentId) ?? { agentId: row.agentId, total: 0, staticTotal: 0, customTotal: 0 };
    cur.staticTotal += row.staticCount;
    cur.customTotal += row.customCount;
    cur.total += row.staticCount + row.customCount;
    byAgent.set(row.agentId, cur);
  }
  return [...byAgent.values()]
    .filter(r => r.total > 0)
    .sort((a, b) => b.total - a.total || a.agentId.localeCompare(b.agentId))
    .slice(0, limit);
}

/** Total flagged calls across the window (for the KPI / empty-state decision). */
export function totalAnomalies(rows: readonly AgentAnomalyStatDto[]): number {
  return rows.reduce((s, r) => s + r.staticCount + r.customCount, 0);
}

export interface WindowSummary {
  total: number;
  staticTotal: number;
  customTotal: number;
  agentCount: number;
}

/** The KPI-row numbers for the window: flagged-call totals split by source, and how many distinct
 * agents produced at least one flag. */
export function summarizeWindow(rows: readonly AgentAnomalyStatDto[]): WindowSummary {
  const agents = new Set<string>();
  let staticTotal = 0, customTotal = 0;
  for (const row of rows) {
    staticTotal += row.staticCount;
    customTotal += row.customCount;
    if (row.staticCount + row.customCount > 0) agents.add(row.agentId);
  }
  return { total: staticTotal + customTotal, staticTotal, customTotal, agentCount: agents.size };
}
