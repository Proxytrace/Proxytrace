import { Trans } from '@lingui/react/macro';
import type { ToolDetailsDto, ToolSpecDto } from '../../../api/models';

interface ToolRowProps {
  kind: 'add' | 'del';
  tool: ToolSpecDto;
}

function ToolRow({ kind, tool }: ToolRowProps) {
  const isAdd = kind === 'add';
  const color = isAdd ? 'var(--success)' : 'var(--danger)';
  const bg = isAdd
    ? 'color-mix(in srgb, var(--success) 6%, transparent)'
    : 'color-mix(in srgb, var(--danger) 6%, transparent)';
  const label = isAdd ? <Trans>+ added</Trans> : <Trans>− removed</Trans>;
  return (
    <div
      className="px-3.5 py-3"
      style={{ background: bg, borderLeft: `3px solid ${color}` }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="mono text-body-sm font-bold" style={{ color }}>{label}</span>
        <span className="mono text-title font-bold" style={{ color }}>{tool.name}</span>
      </div>
      <div className="text-body text-secondary leading-snug pl-2">{tool.description}</div>
    </div>
  );
}

interface Props {
  details: ToolDetailsDto;
}

export function ToolUpdateSection({ details }: Props) {
  const currentNames = new Set(details.currentTools.map(t => t.name));
  const proposedNames = new Set(details.proposedTools.map(t => t.name));
  const added   = details.proposedTools.filter(t => !currentNames.has(t.name));
  const removed = details.currentTools.filter(t => !proposedNames.has(t.name));

  return (
    <div className="bg-[rgba(0,0,0,0.4)] rounded-md overflow-hidden border border-border-subtle" data-testid="tool-update-section">
      <div className="px-3.5 py-2 border-b border-hairline bg-card-2/30">
        <span className="text-caption text-muted font-semibold uppercase tracking-[0.07em]"><Trans>Tool definition diff</Trans></span>
      </div>
      {added.map(t => <ToolRow key={`a-${t.name}`} kind="add" tool={t}/>)}
      {removed.map(t => <ToolRow key={`r-${t.name}`} kind="del" tool={t}/>)}
      {added.length === 0 && removed.length === 0 && (
        <div className="px-3.5 py-3 text-body text-muted"><Trans>No tool additions or removals.</Trans></div>
      )}
    </div>
  );
}
