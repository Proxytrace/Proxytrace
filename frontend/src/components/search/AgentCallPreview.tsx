import { useLingui } from '@lingui/react/macro';
import type { SearchHit } from '../../api/search';
import { useAgentCallPreview } from './hooks/useSearchPreviewQuery';
import { MetaGrid, PreviewLoading } from './SearchPreviewPrimitives';
import { GenericBody } from './SearchGenericBody';
import { ConversationView } from '../conversation/ConversationView';
import { fromAgentCall } from '../conversation/adapters';

interface Props {
  id: string;
  hit: SearchHit;
}

export function AgentCallPreview({ id, hit }: Props) {
  const { t } = useLingui();
  const q = useAgentCallPreview(id);
  if (q.isLoading) return <PreviewLoading />;
  if (q.isError || !q.data) return <GenericBody hit={hit} />;

  const call = q.data;
  return (
    <>
      <MetaGrid entries={[
        ['Agent',  call.agentName ?? '—'],
        [t`Model`,  call.model],
        [t`Status`, String(call.httpStatus)],
        ['Tokens', t`${call.inputTokens} in · ${call.outputTokens} out`],
      ]} />
      <ConversationView messages={fromAgentCall(call)} />
    </>
  );
}
