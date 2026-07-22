import { useLingui } from '@lingui/react/macro';
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
  const { t } = useLingui();
  const q = useEvaluatorPreview(id);
  if (q.isLoading) return <PreviewLoading />;
  if (q.isError || !q.data) return <GenericBody hit={hit} />;

  const e = q.data;
  const entries: [string, string][] = [
    [t`Kind`,     e.kind],
    [t`Endpoint`, e.endpointName ?? '—'],
  ];
  return (
    <>
      <MetaGrid entries={entries} />
      {e.systemMessage && (
        <PreviewSection title={t`System prompt`}>
          <pre className="text-body-sm text-secondary leading-relaxed whitespace-pre-wrap break-words m-0 font-sans">
            {truncate(e.systemMessage, 500)}
          </pre>
        </PreviewSection>
      )}
      {e.jsonSchema && (
        <PreviewSection title={t`JSON schema`}>
          <pre className="text-caption text-secondary font-mono leading-snug whitespace-pre-wrap break-words m-0">
            {truncate(e.jsonSchema, 400)}
          </pre>
        </PreviewSection>
      )}
      {e.extractionPattern && (
        <PreviewSection title={t`Extraction pattern`}>
          <code className="text-body-sm text-secondary font-mono break-words">{e.extractionPattern}</code>
        </PreviewSection>
      )}
    </>
  );
}
