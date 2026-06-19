import { useLingui } from '@lingui/react/macro';
import type { AgentCallDto } from '../../../api/models';
import { ConversationView } from '../../../components/conversation/ConversationView';
import { fromAgentCall } from '../../../components/conversation/adapters';
import { EmptyState } from '../../../components/ui/EmptyState';

interface Props {
  trace: AgentCallDto | null;
}

export function TracePreviewPanel({ trace }: Props) {
  const { t } = useLingui();
  if (!trace) {
    return (
      <div className="h-full flex items-center justify-center">
        <EmptyState title={t`Select a trace to preview`} description={t`Click a row to inspect its conversation.`} />
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto px-4 py-4">
      <ConversationView messages={fromAgentCall(trace)} />
    </div>
  );
}
