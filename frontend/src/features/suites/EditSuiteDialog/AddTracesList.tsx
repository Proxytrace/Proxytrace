import type { AgentCallDto } from '../../../api/models';
import { ColoredBadge } from '../../../components/ui/ColoredBadge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { XIcon, PlusIcon } from '../../../components/icons';
import { cn } from '../../../lib/cn';
import { fmtRelative, fmtTokens } from '../../../lib/format';
import { modelColor } from '../../../lib/colors';

interface Props {
  traces: AgentCallDto[];
  loading: boolean;
  pendingAddTraceIds: Set<string>;
  selectedTraceId: string | null;
  onSelectTrace: (id: string) => void;
  onToggleAdd: (id: string) => void;
  empty: boolean;
  searched: boolean;
}

export function AddTracesList({
  traces, loading, pendingAddTraceIds, selectedTraceId, onSelectTrace, onToggleAdd, empty, searched,
}: Props) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2 p-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[58px] rounded-[9px] bg-card-2 animate-pulse" />
        ))}
      </div>
    );
  }
  if (empty) {
    return <EmptyState title="No traces" description="No agent calls were captured for this agent yet." />;
  }
  if (traces.length === 0 && searched) {
    return <EmptyState title="No matches" description="Clear the search to see all traces." />;
  }
  return (
    <ul className="flex flex-col">
      {traces.map(t => {
        const staged = pendingAddTraceIds.has(t.id);
        const selected = selectedTraceId === t.id;
        const lastMsg = t.request.find(m => m.role === 'user');
        const snippet = (lastMsg?.content ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
        return (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => onSelectTrace(t.id)}
              className={cn(
                'w-full text-left cursor-pointer transition-colors duration-100',
                'px-3 py-2.5',
                'border-l-[3px]',
                staged ? 'border-l-accent' : 'border-l-transparent',
                staged
                  ? 'bg-accent-subtle'
                  : selected
                    ? 'bg-[rgba(255,255,255,0.025)]'
                    : 'bg-transparent',
                'border-b border-b-hairline',
              )}
            >
              <div className="flex items-center gap-2">
                <ColoredBadge color={modelColor(t.model)} label={t.model} dot size="sm" />
                <span className="text-[11px] font-mono text-muted shrink-0">{fmtRelative(t.createdAt)}</span>
                <span className="text-[11px] font-mono text-secondary shrink-0">{fmtTokens(t.inputTokens)}→{fmtTokens(t.outputTokens)}</span>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); onToggleAdd(t.id); }}
                  className={cn(
                    'ml-auto inline-flex items-center gap-1 px-2 py-[3px] rounded-[6px] text-[11px] font-semibold cursor-pointer border transition-colors shrink-0',
                    staged
                      ? 'bg-[var(--accent-subtle)] border-[var(--accent-primary)] text-accent'
                      : 'bg-card-2 border-border text-secondary hover:text-primary',
                  )}
                >
                  {staged ? <><XIcon size={10} /> Staged</> : <><PlusIcon size={10} /> Add</>}
                </button>
              </div>
              <div className="mt-[5px] text-[12px] text-secondary truncate min-w-0">
                {snippet ? snippet : <span className="text-muted italic">No user message</span>}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
