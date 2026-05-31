import { Badge } from '../../../components/ui/Badge';
import { XIcon } from '../../../components/icons';
import type { TraceyArtifact } from '../tracey-artifacts';
import { ChartArtifact } from './artifacts/ChartArtifact';
import { TableArtifact } from './artifacts/TableArtifact';
import { TextArtifact } from './artifacts/TextArtifact';

interface ArtifactPanelProps {
  artifacts: TraceyArtifact[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}

const KIND_LABEL: Record<TraceyArtifact['kind'], string> = {
  chart: 'Chart',
  table: 'Table',
  text: 'Text',
};

/** Right split panel showing artifacts Tracey produced (or the user pinned). */
export function ArtifactPanel({ artifacts, activeId, onSelect, onClose }: ArtifactPanelProps) {
  const active = artifacts.find(a => a.id === activeId) ?? artifacts[artifacts.length - 1];

  return (
    <aside className="flex w-[42%] min-w-[340px] max-w-[560px] flex-col rounded-lg border border-border bg-card">
      <header className="flex items-center justify-between gap-2 border-b border-hairline px-4 py-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
            {active ? KIND_LABEL[active.kind] : 'Artifact'}
          </div>
          <div className="truncate text-h2 font-semibold text-primary">{active?.title}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close artifact panel"
          className="btn-icon shrink-0"
        >
          <XIcon size={16} />
        </button>
      </header>

      {artifacts.length > 1 && (
        <div className="flex flex-wrap gap-1.5 border-b border-hairline px-4 py-2">
          {artifacts.map(a => (
            <button
              key={a.id}
              type="button"
              aria-pressed={a.id === active?.id}
              onClick={() => onSelect(a.id)}
              className="rounded-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-primary)_60%,transparent)]"
            >
              <Badge
                label={a.title}
                variant={a.id === active?.id ? 'accent' : 'neutral'}
                size="sm"
                shape="pill"
                selected={a.id === active?.id}
              />
            </button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {active?.kind === 'chart' && <ChartArtifact artifact={active} />}
        {active?.kind === 'table' && <TableArtifact artifact={active} />}
        {active?.kind === 'text' && <TextArtifact artifact={active} />}
      </div>
    </aside>
  );
}
