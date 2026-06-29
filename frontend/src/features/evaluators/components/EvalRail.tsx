import { useState } from 'react';
import { useLingui } from '@lingui/react/macro';
import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';
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

const FILTER_OPTIONS: { key: TypeFilter; label: MessageDescriptor; category: TypeCategory | null }[] = [
  { key: 'all', label: msg`All`, category: null },
  // eslint-disable-next-line lingui/no-unlocalized-strings -- TypeCategory enum token, not UI copy
  { key: 'llm', label: msg`LLM`, category: 'llm' },
  // eslint-disable-next-line lingui/no-unlocalized-strings -- TypeCategory enum token, not UI copy
  { key: 'rule', label: msg`Rule`, category: 'rule' },
  { key: 'numeric', label: msg`Num`, category: 'numeric' },
];

export function EvalRail({ evaluators, isLoading, selectedId, onSelect, onNew, sparklineById, avgScoreById }: Props) {
  const { t, i18n } = useLingui();
  const [q, setQ] = useState('');
  // eslint-disable-next-line lingui/no-unlocalized-strings -- TypeFilter enum token, not UI copy
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
      // eslint-disable-next-line lingui/no-unlocalized-strings -- data-testid value, not UI copy
      railTestId="evaluator-rail"
      title={t`Evaluators`}
      count={evaluators.length}
      create={{ onClick: onNew, label: t`New evaluator`, testId: 'evaluator-create-btn' }}
      search={{ value: q, onChange: setQ }}
      filter={
        <SegmentedControl
          className="w-full"
          value={typeFilter}
          onChange={setTypeFilter}
          segments={FILTER_OPTIONS.map(opt => ({
            value: opt.key,
            label: i18n._(opt.label),
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
          title={evaluators.length === 0 ? t`No evaluators yet` : t`No matches`}
          description={evaluators.length === 0 ? t`Create one to start scoring runs.` : t`Clear the filters to see all evaluators.`}
        />
      }
    >
      <div className="flex flex-col gap-2.5">
        {groups.map(g => (
          <div key={g.type} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2 px-1 mb-0.5">
              <span className={cn('w-[5px] h-[5px] rounded-[1px]', categoryBg[g.type])} />
              <span className="text-caption text-muted uppercase tracking-[0.09em] font-semibold">
                {i18n._(TYPE_META[g.type].short)}
              </span>
              <span className="text-caption text-muted font-mono ml-auto">{g.items.length}</span>
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
