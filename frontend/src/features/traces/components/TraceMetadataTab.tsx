import type { AgentCallDto } from '../../../api/models';
import { JsonBlock } from '../../../components/ui/JsonBlock';
import { ModelParametersGrid } from '../../../components/ui/ModelParametersGrid';
import { fmtDate } from '../../../lib/format';

// ── Raw JSON tab ───────────────────────────────────────────────────────────────

interface RawJsonProps {
  trace: AgentCallDto;
  tokTotal: number;
}

export function TraceRawJsonTab({ trace, tokTotal }: RawJsonProps) {
  return (
    <JsonBlock value={{
      id: trace.id,
      object: 'chat.completion',
      model: trace.model,
      provider: trace.provider,
      agent_id: trace.agentId,
      agent_name: trace.agentName,
      conversation_id: trace.conversationId,
      messages: trace.request,
      response: trace.response,
      tools: trace.tools,
      usage: {
        prompt_tokens: trace.inputTokens,
        completion_tokens: trace.outputTokens,
        total_tokens: tokTotal,
      },
      finish_reason: trace.finishReason,
      error_message: trace.errorMessage,
      http_status: trace.httpStatus,
      duration_ms: trace.durationMs,
      cost_eur: trace.costEur,
      created_at: trace.createdAt,
      updated_at: trace.updatedAt,
    }} />
  );
}

// ── Metadata tab ───────────────────────────────────────────────────────────────

interface MetadataProps {
  trace: AgentCallDto;
}

export function TraceMetadataTab({ trace }: MetadataProps) {
  const rows: [string, string][] = [
    ['trace.id', trace.id],
    ['provider', trace.provider],
    ['model', trace.model],
    ['agent', trace.agentName ?? '—'],
    ['http_status', String(trace.httpStatus)],
    ['finish_reason', trace.finishReason ?? '—'],
    ['duration_ms', String(trace.durationMs)],
    ['input_tokens', String(trace.inputTokens)],
    ['output_tokens', String(trace.outputTokens)],
    ['cost_eur', trace.costEur != null ? trace.costEur.toFixed(6) : '—'],
    ['created_at', fmtDate(trace.createdAt)],
    ['updated_at', fmtDate(trace.updatedAt)],
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-[10px]">
        {rows.map(([k, v]) => (
          <div key={k} className="px-3 py-[10px] bg-card-2 rounded-[8px]">
            <div className="text-caption text-muted uppercase tracking-[0.06em] mb-[3px]">{k}</div>
            <div
              data-testid={k === 'cost_eur' ? 'trace-metadata-cost' : undefined}
              className="text-body font-mono text-primary break-all"
            >
              {v}
            </div>
          </div>
        ))}
      </div>
      <div className="text-caption text-muted uppercase tracking-[0.08em] font-semibold mt-[6px]">
        Model parameters
      </div>
      <ModelParametersGrid params={trace.modelParameters} />
    </>
  );
}

