import type { SearchHit } from '../../api/search';
import { useTestSuitePreview } from './hooks/useSearchPreviewQuery';
import { MetaGrid, PreviewLoading } from './SearchPreviewPrimitives';
import { GenericBody } from './SearchGenericBody';
import { PreviewSection } from './SearchPreviewLayout';
import { truncate } from './searchMeta';

interface Props {
  id: string;
  hit: SearchHit;
}

export function TestSuitePreview({ id, hit }: Props) {
  const q = useTestSuitePreview(id);
  if (q.isLoading) return <PreviewLoading />;
  if (q.isError || !q.data) return <GenericBody hit={hit} />;

  const s = q.data;
  return (
    <>
      <MetaGrid entries={[
        ['Agent',      s.agentName],
        ['Test cases', String(s.testCases?.length ?? 0)],
        ['Pass rate',  s.passRate != null ? `${(s.passRate * 100).toFixed(0)}%` : '—'],
        ['Total runs', String(s.totalRuns)],
      ]} />
      {s.description && (
        <PreviewSection title="Description">
          <div className="text-[12px] text-white/75 leading-relaxed whitespace-pre-wrap break-words">
            {truncate(s.description, 400)}
          </div>
        </PreviewSection>
      )}
      {s.evaluators && s.evaluators.length > 0 && (
        <PreviewSection title="Evaluators">
          <div className="flex flex-wrap gap-1.5">
            {s.evaluators.map(e => (
              <span
                key={e.id}
                className="px-2 py-[2px] rounded-full text-[10.5px] font-mono"
                style={{ background: 'color-mix(in srgb, var(--warn) 18%, transparent)', color: 'var(--warn)', border: '1px solid color-mix(in srgb, var(--warn) 28%, transparent)' }}
              >
                {e.kind}
              </span>
            ))}
          </div>
        </PreviewSection>
      )}
    </>
  );
}
