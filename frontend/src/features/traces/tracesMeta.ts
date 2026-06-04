// Pure derive/format helpers for the traces UI. No JSX, no I/O — unit-tested
// in tracesMeta.spec.ts.

import type { AgentCallDto } from '../../api/models';

// ── Time range helpers ────────────────────────────────────────────────────────

export const RANGES = [
  { key: '1h', label: '1h' },
  { key: '24h', label: '24h' },
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: 'all', label: 'All' },
] as const;

export type RangeKey = (typeof RANGES)[number]['key'];

export function rangeFrom(key: string): string | undefined {
  const now = Date.now();
  if (key === '1h') return new Date(now - 3_600_000).toISOString();
  if (key === '24h') return new Date(now - 86_400_000).toISOString();
  if (key === '7d') return new Date(now - 7 * 86_400_000).toISOString();
  if (key === '30d') return new Date(now - 30 * 86_400_000).toISOString();
  return undefined;
}

// ── Row types / grouping (shared with the dashboard live stream) ───────────────

export { buildRows } from '../../lib/trace';
export type { ConversationGroup, FlatTrace, TraceRow } from '../../lib/trace';

/**
 * Tool-request count for a trace, 0 when the call has no response. A captured call with no
 * completion (an HTTP error, an empty/dropped completion) has a null `response`, so every
 * tool-count read must go through this rather than dereferencing `response` directly.
 */
export function toolCount(trace: AgentCallDto): number {
  return trace.response?.toolRequests.length ?? 0;
}

// ── Column layout (shared between header row and all trace rows) ───────────────

export const COL_WIDTHS = ['minmax(240px,2fr)', 'minmax(120px,1fr)', '140px', '72px', '70px', '130px', '120px', '80px'] as const;
export const GRID_TEMPLATE = COL_WIDTHS.join(' ');

export const COL_HEADERS = ['Message', 'Agent', 'Model', 'Status', 'Tools', 'Tokens', 'Latency', 'Time'] as const;

// ── Latency bar math ──────────────────────────────────────────────────────────

/** Returns percentage (0–100) for the latency mini-bar (scale: 6 000 ms = 100%). */
export function latencyBarPct(ms: number): number {
  return Math.min(100, ms / 60);
}
