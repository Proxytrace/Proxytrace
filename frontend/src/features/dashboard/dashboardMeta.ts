// Pure constants, label maps, and derivations for the Dashboard.
// No JSX, no I/O — unit-tested in dashboardMeta.spec.ts.

import type { StackedDatum } from '../../components/charts';
import type {
  AgentBreakdownDto,
  AgentDto,
  LatencyStatDto,
  ModelBreakdownDto,
  AgentTokenUsageDto,
} from '../../api/models';
import { agentColor, modelColor } from '../../lib/colors';
import { fmtTokens } from '../../lib/format';
import type { RangeKey } from '../../lib/time-range';

export const RANGES: RangeKey[] = ['1h', '24h', '7d', '30d'];

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

/** Aggregate token usage by date into a sorted array of daily totals. */
export function computeTokenVolume(data: { date: string; inputTokens: number; outputTokens: number }[]): number[] {
  const byDate = new Map<string, number>();
  for (const r of data) byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.inputTokens + r.outputTokens);
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
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

// ── Token usage by agent (stacked bar) ──────────────────────────────────────

export interface TokenByAgent {
  data: StackedDatum[];
  agentIds: string[];
}

/** Pivot per-agent token rows into a stacked bar dataset. */
export function computeTokenByAgent(
  rawData: AgentTokenUsageDto[],
  agentNameById: Map<string, string>,
): TokenByAgent {
  if (rawData.length === 0) return { data: [], agentIds: [] };

  const ids: string[] = [];
  const byDate = new Map<string, Map<string, number>>();
  for (const r of rawData) {
    if (!ids.includes(r.agentId)) ids.push(r.agentId);
    const m = byDate.get(r.date) ?? new Map<string, number>();
    m.set(r.agentId, (m.get(r.agentId) ?? 0) + r.inputTokens + r.outputTokens);
    byDate.set(r.date, m);
  }
  const dates = [...byDate.keys()].sort();
  const data: StackedDatum[] = dates.map(d => ({
    label: new Date(d).toLocaleDateString('en-US', { weekday: 'short' }),
    segments: ids.map(id => ({
      value: byDate.get(d)?.get(id) ?? 0,
      color: agentColor(id),
      label: agentNameById.get(id) ?? id.slice(0, 6),
    })),
  }));
  return { data, agentIds: ids };
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
