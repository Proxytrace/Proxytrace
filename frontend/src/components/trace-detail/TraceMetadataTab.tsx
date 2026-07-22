import type { AgentCallDto } from '../../api/models';
import { JsonBlock } from '../ui/JsonBlock';
import { ModelParametersGrid } from '../ui/ModelParametersGrid';
import { fmtDate } from '../../lib/format';
import { Trans } from '@lingui/react/macro';

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
        prompt_tokens_details: { cached_tokens: trace.cachedInputTokens },
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
    // eslint-disable-next-line lingui/no-unlocalized-strings -- API field name, not UI copy
    ['provider', trace.provider],
    // eslint-disable-next-line lingui/no-unlocalized-strings -- API field name, not UI copy
    ['model', trace.model],
    // eslint-disable-next-line lingui/no-unlocalized-strings -- API field name, not UI copy
    ['agent', trace.agentName ?? '—'],
    ['http_status', String(trace.httpStatus)],
    ['finish_reason', trace.finishReason ?? '—'],
    ['duration_ms', String(trace.durationMs)],
    ['input_tokens', String(trace.inputTokens)],
    ['cached_input_tokens', String(trace.cachedInputTokens)],
    ['output_tokens', String(trace.outputTokens)],
    ['cost_eur', trace.costEur != null ? trace.costEur.toFixed(6) : '—'],
    ['created_at', fmtDate(trace.createdAt)],
    ['updated_at', fmtDate(trace.updatedAt)],
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        {rows.map(([k, v]) => (
          <div key={k} className="px-3 py-2.5 bg-card-2 rounded-md">
            <div className="text-caption text-secondary uppercase tracking-[0.06em] mb-0.5">{k}</div>
            <div
              data-testid={k === 'cost_eur' ? 'trace-metadata-cost' : undefined}
              className="text-body font-mono text-primary break-all"
            >
              {v}
            </div>
          </div>
        ))}
      </div>
      <div className="text-caption text-secondary uppercase tracking-[0.08em] font-semibold mt-1.5">
        <Trans>Model parameters</Trans>
      </div>
      <ModelParametersGrid params={trace.modelParameters} />
    </>
  );
}

