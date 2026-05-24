import type { SearchHit } from '../../api/search';
import { useAgentPreview } from './hooks/useSearchPreviewQuery';
import { MetaGrid, PreviewLoading } from './SearchPreviewPrimitives';
import { GenericBody } from './SearchGenericBody';
import { PreviewSection } from './SearchPreviewLayout';
import { truncate } from './searchMeta';

interface Props {
  id: string;
  hit: SearchHit;
}

export function AgentPreview({ id, hit }: Props) {
  const q = useAgentPreview(id);
  if (q.isLoading) return <PreviewLoading />;
  if (q.isError || !q.data) return <GenericBody hit={hit} />;

  const a = q.data;
  return (
    <>
      <MetaGrid entries={[
        ['Project',  a.projectName],
        ['Endpoint', a.endpointName],
        ['Tools',    String(a.tools?.length ?? 0)],
      ]} />
      {a.systemMessage && (
        <PreviewSection title="System prompt">
          <pre className="text-[11.5px] text-white/75 leading-relaxed whitespace-pre-wrap break-words m-0 font-sans">
            {truncate(a.systemMessage, 600)}
          </pre>
        </PreviewSection>
      )}
      {a.tools && a.tools.length > 0 && (
        <PreviewSection title="Tools">
          <div className="flex flex-wrap gap-1.5">
            {a.tools.map(t => (
              <span
                key={t.name}
                className="px-2 py-[2px] rounded-full text-[10.5px] font-mono bg-success-subtle text-success border border-[color-mix(in_srgb,var(--success)_28%,transparent)]"
                title={t.description}
              >
                {t.name}
              </span>
            ))}
          </div>
        </PreviewSection>
      )}
    </>
  );
}
