// Latency-stat derivations for the Dashboard (weighted percentiles + endpoint spectrum).
// No JSX, no I/O — unit-tested in dashboardMeta.spec.ts (via the dashboardMeta barrel).

import type { AgentListItemDto, LatencyStatDto } from '../../api/models';

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

// ── Endpoint latency spectrum ────────────────────────────────────────────────

export interface EndpointLatencyRow {
  endpointId: string;
  /** Endpoint display name, resolved via the agents that use it (falls back to a short id). */
  name: string;
  minMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  samples: number;
}

/**
 * Percentile display config for the latency spectrum — the one source for marker
 * colors, the legend, and the percentile strip. `rowKey` marks the percentiles drawn
 * as spectrum markers (p90 is strip-only; the per-endpoint DTO doesn't carry it).
 */
export interface PercentileDef {
  key: 'p50' | 'p90' | 'p95' | 'p99';
  color: string;
  rowKey?: 'p50Ms' | 'p95Ms' | 'p99Ms';
}

export const PERCENTILES: PercentileDef[] = [
  { key: 'p50', color: 'var(--text-primary)', rowKey: 'p50Ms' },
  { key: 'p90', color: 'var(--text-primary)' },
  { key: 'p95', color: 'var(--accent-hover)', rowKey: 'p95Ms' },
  { key: 'p99', color: 'var(--warn)', rowKey: 'p99Ms' },
];

/** The subset of {@link PERCENTILES} rendered as markers on each endpoint's span. */
export const SPECTRUM_MARKERS = PERCENTILES.filter(
  (p): p is PercentileDef & { rowKey: NonNullable<PercentileDef['rowKey']> } => p.rowKey !== undefined,
);

/**
 * Per-endpoint latency rows for the spectrum chart, sorted by sample count (desc).
 * The backend only reports endpoint ids; display names are resolved from the agent
 * list (every agent carries its endpoint's name).
 */
export function computeEndpointLatency(latency: LatencyStatDto[], agents: AgentListItemDto[]): EndpointLatencyRow[] {
  const nameByEndpoint = new Map<string, string>();
  for (const a of agents) if (!nameByEndpoint.has(a.endpointId)) nameByEndpoint.set(a.endpointId, a.endpointName);
  return latency
    .map(l => ({
      endpointId: l.endpointId,
      name: nameByEndpoint.get(l.endpointId) ?? l.endpointId.slice(0, 8),
      minMs: l.minMs,
      p50Ms: l.p50Ms,
      p95Ms: l.p95Ms,
      p99Ms: l.p99Ms,
      maxMs: l.maxMs,
      samples: l.sampleCount,
    }))
    .sort((a, b) => b.samples - a.samples);
}
