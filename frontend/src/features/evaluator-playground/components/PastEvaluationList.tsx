import { useState } from 'react';
import { Trans } from '@lingui/react/macro';
import { cn } from '../../../lib/cn';
import { RowButton } from '../../../components/ui/RowButton';
import { SkeletonList } from '../../../components/ui/Skeleton';
import { Popover } from '../../../components/ui/Popover';
import { SearchIcon } from '../../../components/icons';
import { selectionRowStyle, selectionBarStyle, SELECTION_ROW_INACTIVE } from '../../../lib/selectionRow';
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
            className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-card-2 text-body text-muted hover:bg-card transition-colors"
          >
            <SearchIcon size={13} className="shrink-0" />
            <span className="flex-1 text-left truncate"><Trans>Search all past evaluations…</Trans></span>
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

      <span className="text-caption font-semibold uppercase tracking-[0.08em] text-muted px-1 pt-1 shrink-0"><Trans>Recent</Trans></span>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {isLoading ? (
          <SkeletonList rows={4} height={44} />
        ) : items.length === 0 ? (
          <div className="px-2.5 py-5 text-center text-body-sm text-muted leading-relaxed">
            <Trans>No past evaluations yet — search above to load any test case.</Trans>
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
                    'relative flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left overflow-hidden transition-[box-shadow,background-color]',
                    !on && SELECTION_ROW_INACTIVE,
                  )}
                  style={on ? selectionRowStyle('var(--accent-primary)') : undefined}
                >
                  {on && (
                    <span className="absolute left-0 top-2 bottom-2 w-[2.5px] rounded-full" style={selectionBarStyle('var(--accent-primary)')} />
                  )}
                  <ScoreSquare score={it.score} />
                  <span className={cn('flex-1 min-w-0 block text-body font-semibold truncate', on ? 'text-primary' : 'text-secondary')}>
                    {it.label}
                  </span>
                </RowButton>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
