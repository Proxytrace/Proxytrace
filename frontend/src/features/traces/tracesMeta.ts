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

// Minimums are sized so the row still fits a ~900px list (1024px viewport with collapsed
// sidebar); fixed-ish columns get a minmax upper bound so wide screens keep today's layout.
export const COL_WIDTHS = ['minmax(170px,2fr)', 'minmax(96px,1fr)', 'minmax(104px,140px)', '64px', '56px', 'minmax(96px,130px)', 'minmax(88px,120px)', '72px'] as const;
export const GRID_TEMPLATE = COL_WIDTHS.join(' ');

export const COL_HEADERS = ['Message', 'Agent', 'Model', 'Status', 'Tools', 'Tokens', 'Latency', 'Time'] as const;

// ── Narrow-list (mobile) column collapse ───────────────────────────────────────
// On a list narrower than the @2xl container breakpoint (phones), only Message /
// Status / Time survive — the rest are drill-in detail. The list container
// (TraceTable) declares `@container` and exposes both templates as CSS vars; every
// row applies TRACE_GRID_CLS so header and rows stay column-aligned in both modes.
export const COL_MOBILE_VISIBLE = [true, false, false, true, false, false, false, true] as const;
export const GRID_TEMPLATE_NARROW = COL_WIDTHS.filter((_, i) => COL_MOBILE_VISIBLE[i]).join(' ');

/** Grid-template classes shared by the header row and every trace/turn row. */
export const TRACE_GRID_CLS =
  '[grid-template-columns:var(--trace-grid)] @max-2xl:[grid-template-columns:var(--trace-grid-narrow)]';

/** Per-column visibility class, index-aligned with COL_WIDTHS/COL_HEADERS. */
export const COL_VIS_CLS = COL_MOBILE_VISIBLE.map(v => (v ? '' : '@max-2xl:hidden'));

// ── Latency bar math ──────────────────────────────────────────────────────────

/** Returns percentage (0–100) for the latency mini-bar (scale: 6 000 ms = 100%). */
export function latencyBarPct(ms: number): number {
  return Math.min(100, ms / 60);
}
