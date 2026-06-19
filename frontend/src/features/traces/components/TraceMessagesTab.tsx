import type { AgentCallDto } from '../../../api/models';
import { ConversationView } from '../../../components/conversation/ConversationView';
import { fromAgentCall } from '../../../components/conversation/adapters';
import { fmtLatency } from '../../../lib/format';
import { Trans } from '@lingui/react/macro';

interface Props {
  trace: AgentCallDto;
  onJumpToDefinition: (toolName: string) => void;
}

export function TraceMessagesTab({ trace, onJumpToDefinition }: Props) {
  return (
    <ConversationView
      messages={fromAgentCall(trace)}
      onJumpToDefinition={trace.agentId ? onJumpToDefinition : undefined}
      footer={trace.finishReason && (
        <div className="mt-1 px-3 py-2 bg-card-2 rounded-[8px] text-body-sm text-muted font-mono flex items-center gap-2">
          <span className="text-success">●</span>
          finish_reason: <span className="text-secondary">{trace.finishReason}</span>
          <span className="ml-auto"><Trans>completed in {fmtLatency(trace.durationMs)}</Trans></span>
        </div>
      )}
    />
  );
}
