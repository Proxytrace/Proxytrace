import { useState } from 'react';
import { cn } from '../../../lib/cn';
import { RowButton } from '../../../components/ui/RowButton';
import { SkeletonList } from '../../../components/ui/Skeleton';
import { Modal } from '../../../components/overlays/Modal';
import { UnifiedSearch } from '../../../components/search/UnifiedSearch';
import { CheckIcon, SearchIcon } from '../../../components/icons';
import type { SearchHit } from '../../../api/search';
import type { PastEvaluation } from '../hooks/useRecentEvaluations';
import { ScoreSquare } from './ScoreSquare';

interface Props {
  projectId: string;
  items: PastEvaluation[];
  selectedCaseId: string | null;
  onSelect: (testCaseId: string) => void;
  isLoading: boolean;
}

/**
 * Step-2 rail content: the evaluator's recent cases, plus a trigger that opens the
 * shared `UnifiedSearch` in a dialog to reach any past evaluation in the project.
 */
export function PastEvaluationList({ projectId, items, selectedCaseId, onSelect, isLoading }: Props) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <RowButton
        data-testid="test-result-picker"
        onClick={() => setSearchOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-card-2 text-[12px] text-muted hover:bg-card transition-colors"
      >
        <SearchIcon size={13} className="shrink-0" />
        <span className="flex-1 text-left truncate">Search all past evaluations…</span>
      </RowButton>

      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted px-1 pt-1">Recent</span>

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

      {searchOpen && (
        <Modal title="Search past evaluations" onClose={() => setSearchOpen(false)} maxWidth={720}>
          <UnifiedSearch
            projectId={projectId}
            kinds={['testCase']}
            width="auto"
            autoFocus
            showShortcut={false}
            placeholder="Search test cases…"
            onSelect={(hit: SearchHit) => { onSelect(hit.entityId); setSearchOpen(false); }}
          />
        </Modal>
      )}
    </div>
  );
}
