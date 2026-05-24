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

// ── Row types ────────────────────────────────────────────────────────────────

export type ConversationGroup = {
  type: 'conversation';
  conversationId: string;
  turns: AgentCallDto[];
};
export type FlatTrace = { type: 'flat'; trace: AgentCallDto };
export type TraceRow = ConversationGroup | FlatTrace;

/**
 * Groups traces that share a conversationId (multi-turn) into ConversationGroup rows;
 * traces with no conversationId, or whose conversationId appears only once, become FlatTrace rows.
 * Order is preserved from the input array.
 */
export function buildRows(traces: AgentCallDto[]): TraceRow[] {
  const groups = new Map<string, AgentCallDto[]>();
  for (const t of traces) {
    if (t.conversationId) {
      const g = groups.get(t.conversationId) ?? [];
      g.push(t);
      groups.set(t.conversationId, g);
    }
  }
  const multi = new Set(
    [...groups.entries()].filter(([, v]) => v.length > 1).map(([k]) => k),
  );

  const rows: TraceRow[] = [];
  const emitted = new Set<string>();
  for (const t of traces) {
    if (t.conversationId && multi.has(t.conversationId)) {
      if (!emitted.has(t.conversationId)) {
        emitted.add(t.conversationId);
        rows.push({
          type: 'conversation',
          conversationId: t.conversationId,
          turns: groups.get(t.conversationId) ?? [],
        });
      }
    } else {
      rows.push({ type: 'flat', trace: t });
    }
  }
  return rows;
}

// ── Column layout (shared between header row and all trace rows) ───────────────

export const COL_WIDTHS = ['180px', '1fr', '140px', '72px', '70px', '130px', '120px', '80px'] as const;
export const GRID_TEMPLATE = COL_WIDTHS.join(' ');

export const COL_HEADERS = ['Trace ID', 'Agent', 'Model', 'Status', 'Tools', 'Tokens', 'Latency', 'Time'] as const;

// ── Latency bar math ──────────────────────────────────────────────────────────

/** Returns percentage (0–100) for the latency mini-bar (scale: 6 000 ms = 100%). */
export function latencyBarPct(ms: number): number {
  return Math.min(100, ms / 60);
}
