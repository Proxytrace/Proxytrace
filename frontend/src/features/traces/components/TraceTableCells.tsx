// Shared cell renderers used by FlatTraceRow and ConversationGroupRow.
// Each is a tiny presentational component (< 20 lines) with no state.

import { agentColor, modelColor } from '../../../lib/colors';
import { fmtLatency, fmtTokens } from '../../../lib/format';
import type { AgentCallDto } from '../../../api/models';
import { latencyBarPct } from '../tracesMeta';

// ── Latency bar ───────────────────────────────────────────────────────────────

export function LatencyBar({ ms }: { ms: number }) {
  const pct = latencyBarPct(ms);
  const barColor = ms > 3000 ? 'var(--warn)' : 'var(--accent-primary)';
  return (
    <span className="flex-1 max-w-[60px] h-[3px] rounded-full overflow-hidden inline-block align-middle bg-[rgba(255,255,255,0.05)]">
      <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: barColor }} />
    </span>
  );
}

// ── Individual cells ──────────────────────────────────────────────────────────

export function TraceIdCell({ trace }: { trace: AgentCallDto }) {
  const c = trace.agentId ? agentColor(trace.agentId) : modelColor(trace.model);
  return (
    <span className="flex items-center gap-2 min-w-0">
      <span className="w-[3px] h-[18px] rounded-[2px] shrink-0" style={{ background: c }} />
      <span className="mono text-primary text-body-sm">{trace.id.slice(0, 8)}…{trace.id.slice(-4)}</span>
    </span>
  );
}

export function TokenCell({ trace }: { trace: AgentCallDto }) {
  return (
    <span className="mono text-body-sm">
      <span className="text-primary">{fmtTokens(trace.inputTokens + trace.outputTokens)}</span>
      <span className="text-muted ml-[5px] text-caption">{fmtTokens(trace.inputTokens)}/{fmtTokens(trace.outputTokens)}</span>
    </span>
  );
}

export function ToolsCell({ count }: { count: number }) {
  return count > 0
    ? <span className="mono text-body-sm text-primary">{count}</span>
    : <span className="text-muted text-body-sm">—</span>;
}

export function LatencyCell({ ms }: { ms: number }) {
  return (
    <span className="flex items-center gap-[7px]">
      <span className={`mono text-body-sm min-w-[40px] shrink-0 ${ms > 3000 ? 'text-warn' : 'text-secondary'}`}>
        {fmtLatency(ms)}
      </span>
      <LatencyBar ms={ms} />
    </span>
  );
}
