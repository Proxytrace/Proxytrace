import type { SearchHit } from '../../api/search';
import { useEvaluatorPreview } from './hooks/useSearchPreviewQuery';
import { MetaGrid, PreviewLoading } from './SearchPreviewPrimitives';
import { GenericBody } from './SearchGenericBody';
import { PreviewSection } from './SearchPreviewLayout';
import { truncate } from './searchMeta';

interface Props {
  id: string;
  hit: SearchHit;
}

export function EvaluatorPreview({ id, hit }: Props) {
  const q = useEvaluatorPreview(id);
  if (q.isLoading) return <PreviewLoading />;
  if (q.isError || !q.data) return <GenericBody hit={hit} />;

  const e = q.data;
  const entries: [string, string][] = [
    ['Kind',     e.kind],
    ['Endpoint', e.endpointName ?? '—'],
  ];
  return (
    <>
      <MetaGrid entries={entries} />
      {e.systemMessage && (
        <PreviewSection title="System prompt">
          <pre className="text-[11.5px] text-white/75 leading-relaxed whitespace-pre-wrap break-words m-0 font-sans">
            {truncate(e.systemMessage, 500)}
          </pre>
        </PreviewSection>
      )}
      {e.jsonSchema && (
        <PreviewSection title="JSON schema">
          <pre className="text-[10.5px] text-white/70 font-mono leading-snug whitespace-pre-wrap break-words m-0">
            {truncate(e.jsonSchema, 400)}
          </pre>
        </PreviewSection>
      )}
      {e.extractionPattern && (
        <PreviewSection title="Extraction pattern">
          <code className="text-[11px] text-white/75 font-mono break-words">{e.extractionPattern}</code>
        </PreviewSection>
      )}
    </>
  );
}
