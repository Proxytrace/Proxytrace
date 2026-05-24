import type { SystemPromptDetailsDto } from '../../../api/models';
import { buildPromptDiff } from '../proposalsMeta';

interface PromptDiffProps {
  before: string;
  after: string;
}

function PromptDiffView({ before, after }: PromptDiffProps) {
  const rendered = buildPromptDiff(before, after);
  const adds = rendered.filter(r => r.kind === 'add').length;
  const dels = rendered.filter(r => r.kind === 'del').length;

  return (
    <div className="bg-[rgba(0,0,0,0.4)] rounded-md overflow-hidden border border-border-subtle">
      <div className="flex items-center gap-2.5 px-3.5 py-2 border-b border-hairline bg-card-2/30">
        <span className="text-caption text-muted font-semibold uppercase tracking-[0.07em]">System prompt</span>
        <span className="mono text-body-sm text-success">+{adds}</span>
        <span className="mono text-body-sm text-danger">−{dels}</span>
      </div>
      <div className="mono text-body leading-[1.65]">
        {rendered.map((r, i) => {
          const color = r.kind === 'add'
            ? 'var(--success)'
            : r.kind === 'del'
            ? 'var(--danger)'
            : 'var(--text-secondary)';
          const bg = r.kind === 'add'
            ? 'color-mix(in srgb, var(--success) 8%, transparent)'
            : r.kind === 'del'
            ? 'color-mix(in srgb, var(--danger) 8%, transparent)'
            : 'transparent';
          const sigil = r.kind === 'add' ? '+' : r.kind === 'del' ? '−' : ' ';
          const sigilColor = r.kind === 'add' ? 'var(--success)' : r.kind === 'del' ? 'var(--danger)' : 'var(--text-muted)';
          return (
            <div key={i} className="flex" style={{ background: bg, padding: '1px 0' }}>
              <span className="text-caption text-right select-none shrink-0 text-muted opacity-50 w-9 pl-3.5 pr-2">{i + 1}</span>
              <span className="font-bold shrink-0 text-center w-[18px]" style={{ color: sigilColor }}>{sigil}</span>
              <span className="flex-1 whitespace-pre-wrap break-words pr-3.5" style={{ color }}>{r.text || ' '}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface Props {
  details: SystemPromptDetailsDto;
}

export function SystemPromptSection({ details }: Props) {
  return <PromptDiffView before={details.currentSystemMessage} after={details.proposedSystemMessage}/>;
}
