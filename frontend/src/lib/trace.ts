// Pure helpers for deriving display bits from a captured trace, plus conversation
// grouping shared by the Traces tab and the dashboard live stream. No JSX, no I/O.

import type { AgentCallDto } from '../api/models';

/**
 * Preview text for a trace row: the first user message in the request, with
 * collapsed whitespace. Returns null when the request has no user message
 * (callers render an em-dash placeholder). Truncation is left to CSS ellipsis.
 */
export function firstUserMessage(call: AgentCallDto): string | null {
  const text = call.request.find(m => m.role === 'user')?.content?.replace(/\s+/g, ' ').trim();
  return text ? text : null;
}

// ── Conversation grouping ──────────────────────────────────────────────────────

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
