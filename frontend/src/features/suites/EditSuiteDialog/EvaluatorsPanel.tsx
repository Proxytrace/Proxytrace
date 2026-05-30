import { useState } from 'react';
import type { EvaluatorDetailDto } from '../../../api/models';
import { EVALUATOR_KIND_COLOR, EVALUATOR_KIND_CATEGORY } from '../../../lib/colors';
import { ColoredBadge } from '../../../components/ui/ColoredBadge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { SearchIcon, CheckIcon } from '../../../components/icons';

interface Props {
  evaluators: EvaluatorDetailDto[];
  baselineIds: Set<string>;
  stagedIds: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
}

export function EvaluatorsPanel({ evaluators, baselineIds, stagedIds, selectedId, onSelect, onToggle }: Props) {
  const [search, setSearch] = useState('');

  const q = search.trim().toLowerCase();
  const filtered = q
    ? evaluators.filter(e => e.name.toLowerCase().includes(q) || e.kind.toLowerCase().includes(q))
    : evaluators;

  return (
    <div className="flex flex-col gap-3 min-h-0 h-full">
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-semibold text-muted uppercase tracking-[0.08em]">
          {stagedIds.size} of {evaluators.length} attached
        </span>
        <DiffSummary baseline={baselineIds} staged={stagedIds} />
      </div>

      <label className="flex items-center gap-2 px-3 rounded-[9px] bg-card-2 border border-border focus-within:border-[var(--accent-primary)] transition-colors cursor-text">
        <SearchIcon size={13} />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search evaluators…"
          className="flex-1 min-w-0 bg-transparent border-0 py-[8px] text-[13px] outline-none text-primary placeholder:text-muted"
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} className="text-[11px] text-muted hover:text-primary cursor-pointer bg-transparent border-0">clear</button>
        )}
      </label>

      <div className="flex-1 min-h-0 overflow-y-auto rounded-[12px] border border-border bg-card">
        {evaluators.length === 0 && (
          <EmptyState title="No evaluators" description="Create evaluators in the Evaluators tab first." />
        )}
        {evaluators.length > 0 && filtered.length === 0 && (
          <EmptyState title="No matches" description="Clear the search to see all evaluators." />
        )}
        {filtered.length > 0 && (
          <ul className="flex flex-col">
            {filtered.map(e => {
              const c = EVALUATOR_KIND_COLOR[e.kind];
              const cat = EVALUATOR_KIND_CATEGORY[e.kind];
              const staged = stagedIds.has(e.id);
              const wasBaseline = baselineIds.has(e.id);
              const focused = selectedId === e.id;
              const dirtyState =
                staged && !wasBaseline ? 'added'
                : !staged && wasBaseline ? 'removed'
                : null;
              return (
                <li
                  key={e.id}
                  onClick={() => onSelect(e.id)}
                  className="cursor-pointer transition-colors duration-100"
                  style={{
                    padding: '10px 12px',
                    borderLeft: `3px solid ${staged ? 'var(--accent-primary)' : 'transparent'}`,
                    background: focused ? 'rgba(255,255,255,0.025)' : 'transparent',
                    borderBottom: '1px solid var(--hairline)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      data-testid={`edit-suite-evaluator-toggle-${e.id}`}
                      onClick={ev => { ev.stopPropagation(); onToggle(e.id); }}
                      className="shrink-0 inline-flex items-center justify-center cursor-pointer transition-colors"
                      style={{
                        width: 16, height: 16, borderRadius: 4,
                        background: staged ? c : 'var(--bg-card-2)',
                        border: `1px solid ${staged ? c : 'var(--border-color)'}`,
                      }}
                      title={staged ? 'Remove' : 'Attach'}
                    >
                      {staged && <CheckIcon size={11} className="text-white" strokeWidth={3} />}
                    </button>
                    <ColoredBadge color={c} label={e.kind} />
                    <span className="text-[10.5px] font-mono text-muted uppercase tracking-[0.06em]">{cat}</span>
                    <span className="text-[13px] font-medium flex-1 min-w-0 truncate ml-1">{e.name}</span>
                    {dirtyState === 'added' && (
                      <span className="text-[10px] font-semibold text-accent uppercase tracking-[0.08em] shrink-0">+ Added</span>
                    )}
                    {dirtyState === 'removed' && (
                      <span className="text-[10px] font-semibold text-warn uppercase tracking-[0.08em] shrink-0">− Removed</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function DiffSummary({ baseline, staged }: { baseline: Set<string>; staged: Set<string> }) {
  let added = 0;
  let removed = 0;
  staged.forEach(id => { if (!baseline.has(id)) added++; });
  baseline.forEach(id => { if (!staged.has(id)) removed++; });
  if (added === 0 && removed === 0) {
    return <span className="text-[11px] text-muted">No changes</span>;
  }
  return (
    <span className="text-[11px] flex items-center gap-2">
      {added > 0 && <span className="text-accent font-semibold">+{added}</span>}
      {removed > 0 && <span className="text-warn font-semibold">−{removed}</span>}
    </span>
  );
}
