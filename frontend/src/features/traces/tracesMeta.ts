// Pure derive/format helpers for the traces UI. No JSX, no I/O — unit-tested
// in tracesMeta.spec.ts.

import type { AgentCallListItemDto } from '../../api/models';
import { ALL_TIME, type TimeRange, type TimeRangePreset } from '../../lib/timeRange';

// ── Time range helpers ────────────────────────────────────────────────────────

/** Auto-default thresholds: smallest preset whose window still contains the newest trace. */
const AUTO_THRESHOLDS: readonly { maxAgeMs: number; preset: TimeRangePreset }[] = [
  { maxAgeMs: 15 * 60_000, preset: '15m' },
  { maxAgeMs: 60 * 60_000, preset: '1h' },
  { maxAgeMs: 6 * 60 * 60_000, preset: '6h' },
  { maxAgeMs: 24 * 60 * 60_000, preset: '24h' },
  { maxAgeMs: 7 * 24 * 60 * 60_000, preset: '7d' },
  { maxAgeMs: 30 * 24 * 60 * 60_000, preset: '30d' },
];

/** Smallest preset window that still contains the newest trace; "all time" when none/too old. */
export function autoTimeRange(newestTraceIso: string | null, now: number = Date.now()): TimeRange {
  if (!newestTraceIso) return ALL_TIME;
  const age = now - new Date(newestTraceIso).getTime();
  const match = AUTO_THRESHOLDS.find(t => age <= t.maxAgeMs);
  return match ? { kind: 'preset', preset: match.preset } : ALL_TIME;
}

// ── Row types / grouping (shared with the dashboard live stream) ───────────────

export { buildRows } from '../../lib/trace';
export type { ConversationGroup, FlatTrace, TraceRow } from '../../lib/trace';

/**
 * Tool-request count for a trace — the backend precomputes it into the light row
 * ({@link AgentCallListItemDto.toolCount}; 0 when the call produced no response).
 */
export function toolCount(trace: AgentCallListItemDto): number {
  return trace.toolCount;
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
