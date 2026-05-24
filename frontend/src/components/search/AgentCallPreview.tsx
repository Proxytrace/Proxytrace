import type { SearchHit } from '../../api/search';
import { useAgentCallPreview } from './hooks/useSearchPreviewQuery';
import { MetaGrid, PreviewLoading } from './SearchPreviewPrimitives';
import { GenericBody } from './SearchGenericBody';
import { Conversation } from './SearchPreviewLayout';

interface Props {
  id: string;
  hit: SearchHit;
}

export function AgentCallPreview({ id, hit }: Props) {
  const q = useAgentCallPreview(id);
  if (q.isLoading) return <PreviewLoading />;
  if (q.isError || !q.data) return <GenericBody hit={hit} />;

  const call = q.data;
  // Defensively filter nullish entries in case the response field is absent at runtime
  const messages = [
    ...call.request,
    call.response,
  ].filter(m => m != null);
  return (
    <>
      <MetaGrid entries={[
        ['Agent',  call.agentName ?? '—'],
        ['Model',  call.model],
        ['Status', String(call.httpStatus)],
        ['Tokens', `${call.inputTokens} in · ${call.outputTokens} out`],
      ]} />
      <Conversation messages={messages.map(m => ({ role: m.role, content: m.content }))} />
    </>
  );
}
