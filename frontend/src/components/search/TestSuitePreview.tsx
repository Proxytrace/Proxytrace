import { useLingui } from '@lingui/react/macro';
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
  const { t } = useLingui();
  const q = useTestSuitePreview(id);
  if (q.isLoading) return <PreviewLoading />;
  if (q.isError || !q.data) return <GenericBody hit={hit} />;

  const s = q.data;
  return (
    <>
      <MetaGrid entries={[
        [t`Agent`,     s.agentName],
        [t`Test cases`, String(s.testCases?.length ?? 0)],
        [t`Pass rate`,  s.passRate != null ? `${(s.passRate * 100).toFixed(0)}%` : '—'],
        [t`Total runs`, String(s.totalRuns)],
      ]} />
      {s.description && (
        <PreviewSection title={t`Description`}>
          <div className="text-body text-white/75 leading-relaxed whitespace-pre-wrap break-words">
            {truncate(s.description, 400)}
          </div>
        </PreviewSection>
      )}
      {s.evaluators && s.evaluators.length > 0 && (
        <PreviewSection title={t`Evaluators`}>
          <div className="flex flex-wrap gap-1.5">
            {s.evaluators.map(e => (
              <span
                key={e.id}
                className="px-2 py-0.5 rounded-full text-caption font-mono bg-[color-mix(in_srgb,var(--warn)_18%,transparent)] text-warn border border-[color-mix(in_srgb,var(--warn)_28%,transparent)]"
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
