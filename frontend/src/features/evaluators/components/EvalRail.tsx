import { useState } from 'react';
import { cn } from '../../../lib/cn';
import { SkeletonList } from '../../../components/ui/Skeleton';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { PlusIcon, SearchLineIcon } from '../../../components/icons';
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
    <aside data-testid="evaluator-rail" className="flex flex-col min-h-0 overflow-hidden bg-card rounded-lg shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-[9px] px-3.5 pt-3.5 pb-2.5 border-b border-hairline">
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-bold tracking-[-0.015em]">Evaluators</span>
          <span className="text-[10.5px] text-muted font-mono">{evaluators.length}</span>
        </div>
        <Button
          variant="primary"
          size="sm"
          fullWidth
          data-testid="evaluator-create-btn"
          leftIcon={<PlusIcon size={12} />}
          onClick={onNew}
        >
          New evaluator
        </Button>
        <Input
          leftAddon={<SearchLineIcon size={12} />}
          inputSize="sm"
          value={q}
          onChange={ev => setQ(ev.target.value)}
          placeholder="Search…"
        />
      </div>

      <div className="px-2.5 py-2 border-b border-hairline">
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
