import { useState } from 'react';
import { cn } from '../../../lib/cn';
import { SkeletonList } from '../../../components/ui/Skeleton';
import { PlusIcon } from '../../../components/icons';
import type { EvaluatorDetailDto } from '../../../api/models';
import {
  KIND_CATEGORY,
  TYPE_META,
  TYPE_CATEGORIES,
  type TypeCategory,
  type TypeFilter,
} from '../evaluatorMeta';
import { categoryBg } from '../categoryClasses';
import { EvaluatorRow } from './EvaluatorRow';
import { SearchLineIcon } from '../../../components/icons';

interface Props {
  evaluators: EvaluatorDetailDto[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  sparklineById: Map<string, number[]>;
  avgScoreById: Map<string, number | null>;
}

const FILTER_OPTIONS: { key: TypeFilter; label: string; category: TypeCategory | null }[] = [
  { key: 'all', label: 'All', category: null },
  { key: 'llm', label: 'LLM', category: 'llm' },
  { key: 'rule', label: 'Rule', category: 'rule' },
  { key: 'numeric', label: 'Num', category: 'numeric' },
];

export function EvalRail({ evaluators, isLoading, selectedId, onSelect, onNew, sparklineById, avgScoreById }: Props) {
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const filtered = evaluators.filter(e => {
    if (typeFilter !== 'all' && KIND_CATEGORY[e.kind] !== typeFilter) return false;
    if (q && !e.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const groups = TYPE_CATEGORIES
    .map(type => ({ type, items: filtered.filter(e => KIND_CATEGORY[e.kind] === type) }))
    .filter(g => g.items.length > 0);

  return (
    <aside className="flex flex-col min-h-0 overflow-hidden bg-card rounded-lg shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-[9px] px-3.5 pt-3.5 pb-2.5 border-b border-hairline">
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-bold tracking-[-0.015em]">Evaluators</span>
          <span className="text-[10.5px] text-muted font-mono">{evaluators.length}</span>
        </div>
        <button
          onClick={onNew}
          data-write
          className="w-full px-3 py-2 rounded-md text-[12.5px] font-semibold text-white border-0 inline-flex items-center justify-center gap-1.5 cursor-pointer bg-[image:var(--grad-accent)] shadow-[var(--shadow-btn)]"
        >
          <PlusIcon size={12} /> New evaluator
        </button>
        <div className="flex items-center gap-[7px] px-[9px] py-1.5 rounded-md text-muted bg-card-2 border border-subtle">
          <SearchLineIcon size={12} />
          <input
            value={q}
            onChange={ev => setQ(ev.target.value)}
            placeholder="Search…"
            className="flex-1 min-w-0 bg-transparent border-0 outline-none text-primary text-[12px]"
          />
        </div>
      </div>

      <div className="px-2.5 py-2 border-b border-hairline">
        <div className="flex gap-[3px]">
          {FILTER_OPTIONS.map(opt => {
            const active = typeFilter === opt.key;
            const count = opt.key === 'all'
              ? evaluators.length
              : evaluators.filter(e => KIND_CATEGORY[e.kind] === opt.key).length;
            return (
              <button
                key={opt.key}
                onClick={() => setTypeFilter(opt.key)}
                className={cn(
                  'flex-1 px-1.5 py-[5px] rounded-md text-[11px] font-medium border-0 cursor-pointer inline-flex items-center justify-center gap-[5px]',
                  active ? 'bg-card-2 text-primary' : 'bg-transparent text-secondary',
                )}
              >
                {opt.category && (
                  <span className={cn('w-[5px] h-[5px] rounded-[1px]', categoryBg[opt.category], active ? 'opacity-100' : 'opacity-50')} />
                )}
                {opt.label}
                <span className={cn(
                  'px-[5px] rounded-full text-[9.5px] font-mono font-semibold',
                  active ? 'bg-accent-subtle text-accent-hover' : 'bg-transparent text-muted',
                )}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2.5 flex flex-col gap-2.5">
        {isLoading ? (
          <SkeletonList rows={6} height={48} gap={4} />
        ) : groups.length === 0 ? (
          <div className="p-5 text-center text-muted text-[12px]">
            {evaluators.length === 0 ? 'No evaluators yet.' : 'No matches.'}
          </div>
        ) : (
          groups.map(g => (
            <div key={g.type} className="flex flex-col gap-[3px]">
              <div className="flex items-center gap-2 px-1 mb-0.5">
                <span className={cn('w-[5px] h-[5px] rounded-[1px]', categoryBg[g.type])} />
                <span className="text-[10px] text-muted uppercase tracking-[0.09em] font-semibold">
                  {TYPE_META[g.type].short}
                </span>
                <span className="text-[9.5px] text-muted font-mono ml-auto">{g.items.length}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                {g.items.map(e => (
                  <EvaluatorRow
                    key={e.id}
                    evaluator={e}
                    isSelected={e.id === selectedId}
                    onSelect={onSelect}
                    sparkline={sparklineById.get(e.id)}
                    avgScore={avgScoreById.get(e.id) ?? null}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
