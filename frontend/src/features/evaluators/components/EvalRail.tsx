import { useState } from 'react';
import { cn } from '../../../lib/cn';
import { ListRail } from '../../../components/ui/ListRail';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { EmptyState } from '../../../components/ui/EmptyState';
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
    <ListRail
      railTestId="evaluator-rail"
      title="Evaluators"
      count={evaluators.length}
      create={{ onClick: onNew, label: 'New evaluator', testId: 'evaluator-create-btn' }}
      search={{ value: q, onChange: setQ }}
      filter={
        <SegmentedControl
          className="w-full"
          value={typeFilter}
          onChange={setTypeFilter}
          segments={FILTER_OPTIONS.map(opt => ({
            value: opt.key,
            label: opt.label,
            count: opt.key === 'all'
              ? evaluators.length
              : evaluators.filter(e => KIND_CATEGORY[e.kind] === opt.key).length,
            icon: opt.category
              ? <span className={cn('w-[5px] h-[5px] rounded-[1px]', categoryBg[opt.category])} />
              : undefined,
          }))}
        />
      }
      loading={isLoading}
      skeletonHeight={48}
      isEmpty={groups.length === 0}
      empty={
        <EmptyState
          title={evaluators.length === 0 ? 'No evaluators yet' : 'No matches'}
          description={evaluators.length === 0 ? 'Create one to start scoring runs.' : 'Clear the filters to see all evaluators.'}
        />
      }
    >
      <div className="flex flex-col gap-2.5">
        {groups.map(g => (
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
        ))}
      </div>
    </ListRail>
  );
}
