import type { SearchHit } from '../../api/search';
import type { TestSuiteMessageDto } from '../../api/models';
import { useTestCasePreview } from './hooks/useSearchPreviewQuery';
import { MetaGrid, PreviewLoading } from './SearchPreviewPrimitives';
import { GenericBody } from './SearchGenericBody';
import { ConversationView } from '../conversation/ConversationView';
import { fromSimple } from '../conversation/adapters';

interface Props {
  id: string;
  hit: SearchHit;
}

export function TestCasePreview({ id, hit }: Props) {
  const q = useTestCasePreview(id);
  if (q.isLoading) return <PreviewLoading />;
  if (q.isError || !q.data) return <GenericBody hit={hit} />;

  const tc = q.data;
  const meta = hit.metadata ?? {};
  const msgs: { role: string; content: string }[] = [
    ...(tc.input ?? []).map((m: TestSuiteMessageDto) => ({ role: m.role, content: m.content })),
  ];
  if (tc.expectedOutput) {
    msgs.push({ role: `expected (${tc.expectedOutput.role})`, content: tc.expectedOutput.content });
  }
  return (
    <>
      <MetaGrid entries={[
        ['Suite', meta.suiteName ?? '—'],
        ['Agent', meta.agentName ?? '—'],
      ]} />
      <ConversationView messages={fromSimple(msgs)} />
    </>
  );
}
