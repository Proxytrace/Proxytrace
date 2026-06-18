import { useState } from 'react';
import { cn } from '../../../lib/cn';
import { RowButton } from '../../../components/ui/RowButton';
import { SkeletonList } from '../../../components/ui/Skeleton';
import { Popover } from '../../../components/ui/Popover';
import { CheckIcon, SearchIcon } from '../../../components/icons';
import type { PastEvaluation } from '../hooks/useRecentEvaluations';
import { ScoreSquare } from './ScoreSquare';
import { PastEvaluationSearch } from './PastEvaluationSearch';

interface Props {
  evaluatorId: string;
  evaluatorName: string;
  items: PastEvaluation[];
  selectedCaseId: string | null;
  onSelect: (testCaseId: string) => void;
  isLoading: boolean;
}

/**
 * Step-2 rail content: the evaluator's recent cases, plus a trigger that opens an
 * evaluator-scoped search popover to reach any of this evaluator's past evaluations.
 */
export function PastEvaluationList({ evaluatorId, evaluatorName, items, selectedCaseId, onSelect, isLoading }: Props) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2">
      <Popover
        open={searchOpen}
        onOpenChange={setSearchOpen}
        align="start"
        side="bottom"
        className="p-2"
        trigger={
          <RowButton
            data-testid="test-result-picker"
            aria-expanded={searchOpen}
            className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-card-2 text-[12px] text-muted hover:bg-card transition-colors"
          >
            <SearchIcon size={13} className="shrink-0" />
            <span className="flex-1 text-left truncate">Search all past evaluations…</span>
          </RowButton>
        }
      >
        <PastEvaluationSearch
          evaluatorId={evaluatorId}
          evaluatorName={evaluatorName}
          recent={items}
          onPick={(testCaseId) => { onSelect(testCaseId); setSearchOpen(false); }}
        />
      </Popover>

      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted px-1 pt-1 shrink-0">Recent</span>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {isLoading ? (
          <SkeletonList rows={4} height={44} />
        ) : items.length === 0 ? (
          <div className="px-2.5 py-5 text-center text-[11.5px] text-muted leading-relaxed">
            No past evaluations yet — search above to load any test case.
          </div>
        ) : (
          <div data-testid="past-evaluation-list" className="flex flex-col gap-1">
            {items.map(it => {
              const on = it.testCaseId === selectedCaseId;
              return (
                <RowButton
                  key={it.testCaseId}
                  data-testid={`past-evaluation-row-${it.testCaseId}`}
                  aria-pressed={on}
                  onClick={() => onSelect(it.testCaseId)}
                  className={cn(
                    'flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left border transition-colors',
                    on ? 'bg-card border-border' : 'border-transparent hover:bg-card',
                  )}
                >
                  <ScoreSquare score={it.score} />
                  <span className={cn('flex-1 min-w-0 block text-[12px] font-semibold truncate', on ? 'text-primary' : 'text-secondary')}>
                    {it.label}
                  </span>
                  {on && <CheckIcon size={14} className="text-accent shrink-0" />}
                </RowButton>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
