// Agent-fleet roster derivations for the Dashboard.
// No JSX, no I/O — unit-tested in dashboardMeta.spec.ts (via the dashboardMeta barrel).

import type {
  AgentBreakdownDto,
  AgentListItemDto,
  AgentTokenUsageDto,
} from '../../api/models';
import type { RangeKey, StatisticsBucket } from '../../lib/time-range';
import { fillTokenGrid, tokenGridBounds } from './tokenSeries';

export interface AgentFleetEntry {
  id: string;
  name: string;
  endpointName: string;
  toolCount: number;
  lastUsedAt: string | null;
  /** Captured calls in range (agent breakdown). */
  traces: number;
  /** Total tokens (input + output) in range. */
  tokens: number;
  /** Fraction of the fleet's token total (0–1). */
  share: number;
  /** Per-bucket token activity over the range, downsampled to ≤ {@link FLEET_SPARK_POINTS}. */
  series: number[];
}

/** Resolution cap for the fleet sparklines — enough shape without 720-point SVGs per row. */
export const FLEET_SPARK_POINTS = 36;

/** Sum-pool `values` down to at most `maxPoints` buckets (order-preserving, total-preserving). */
export function downsampleSum(values: number[], maxPoints: number): number[] {
  if (values.length <= maxPoints) return values;
  const out = new Array(maxPoints).fill(0) as number[];
  for (let i = 0; i < values.length; i++) {
    out[Math.min(maxPoints - 1, Math.floor((i * maxPoints) / values.length))] += values[i];
  }
  return out;
}

/**
 * Build the agent-fleet roster: every non-system agent with its trace count, token
 * total + fleet share, and a gap-filled activity sparkline over the selected range.
 * All sparklines share one bucket grid so their shapes are comparable across rows.
 * Sorted by tokens desc, then traces desc, then name.
 */
export function computeAgentFleet(
  agents: AgentListItemDto[],
  breakdown: AgentBreakdownDto[],
  rawTokens: AgentTokenUsageDto[],
  range: RangeKey,
  bucket: StatisticsBucket,
): AgentFleetEntry[] {
  const visible = agents.filter(a => !a.isSystemAgent);
  const visibleIds = new Set(visible.map(a => a.id));

  const perAgent = new Map<string, Map<number, number>>();
  for (const r of rawTokens) {
    if (!visibleIds.has(r.agentId)) continue;
    const ms = Date.parse(r.bucketStart);
    if (Number.isNaN(ms)) continue;
    let sums = perAgent.get(r.agentId);
    if (!sums) perAgent.set(r.agentId, (sums = new Map<number, number>()));
    sums.set(ms, (sums.get(ms) ?? 0) + r.inputTokens + r.outputTokens);
  }

  function* allBucketKeys(): Iterable<number> {
    for (const sums of perAgent.values()) yield* sums.keys();
  }
  const bounds = tokenGridBounds(allBucketKeys(), range, bucket);

  const entries: AgentFleetEntry[] = visible.map(a => {
    const sums = perAgent.get(a.id);
    let tokens = 0;
    if (sums) for (const v of sums.values()) tokens += v;
    const series = bounds
      ? downsampleSum(fillTokenGrid(sums ?? new Map(), bounds.startMs, bounds.endMs, bounds.bucketMs).values, FLEET_SPARK_POINTS)
      : [];
    return {
      id: a.id,
      name: a.name,
      endpointName: a.endpointName,
      toolCount: a.toolCount,
      lastUsedAt: a.lastUsedAt,
      traces: agentCallCount(breakdown, a.id),
      tokens,
      share: 0,
      series,
    };
  });
  const total = entries.reduce((n, e) => n + e.tokens, 0);
  for (const e of entries) e.share = total > 0 ? e.tokens / total : 0;
  entries.sort((x, y) => y.tokens - x.tokens || y.traces - x.traces || x.name.localeCompare(y.name));
  return entries;
}

// ── Trace count per agent ────────────────────────────────────────────────────

/** Look up call count for a specific agent from the breakdown list. */
export function agentCallCount(breakdown: AgentBreakdownDto[], agentId: string): number {
  return breakdown.find(b => b.agentId === agentId)?.callCount ?? 0;
}
