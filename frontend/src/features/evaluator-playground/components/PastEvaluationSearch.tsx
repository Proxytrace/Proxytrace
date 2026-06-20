import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { cn } from '../../../lib/cn';
import { Input } from '../../../components/ui/Input';
import { RowButton } from '../../../components/ui/RowButton';
import { SearchIcon } from '../../../components/icons';
import { useDebounce } from '../../../hooks/useDebounce';
import { useEvaluatorEvaluationSearch, MIN_QUERY } from '../hooks/useEvaluatorEvaluationSearch';
import type { PastEvaluation } from '../hooks/useRecentEvaluations';
import { ScoreSquare } from './ScoreSquare';
import { PastEvaluationPreview } from './PastEvaluationPreview';

interface Props {
  evaluatorId: string;
  evaluatorName: string;
  recent: PastEvaluation[];
  onPick: (testCaseId: string) => void;
}

/**
 * Evaluator-scoped past-evaluation picker (the popover body). Empty query shows the recent
 * list; typing searches this evaluator's evaluations. Left list + right verdict/test-case
 * preview, bounded height with internal scroll so it never clips the viewport.
 */
export function PastEvaluationSearch({ evaluatorId, evaluatorName, recent, onPick }: Props) {
  const { t } = useLingui();
  const [raw, setRaw] = useState('');
  const debounced = useDebounce(raw, 200);
  const { results, isFetching, active } = useEvaluatorEvaluationSearch(evaluatorId, debounced);

  const list = active ? results : recent;
  const [activeId, setActiveId] = useState<string | null>(null);
  const effectiveActiveId = list.some(i => i.testCaseId === activeId) ? activeId : list[0]?.testCaseId ?? null;

  function move(delta: number) {
    if (list.length === 0) return;
    const idx = Math.max(0, list.findIndex(i => i.testCaseId === effectiveActiveId));
    const next = Math.min(list.length - 1, Math.max(0, idx + delta));
    setActiveId(list[next].testCaseId);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter' && effectiveActiveId) { e.preventDefault(); onPick(effectiveActiveId); }
  }

  const tooShort = debounced.trim().length > 0 && debounced.trim().length < MIN_QUERY;

  return (
    <div className="flex flex-col w-[680px] max-w-[88vw] max-h-[70vh]">
      <Input
        autoFocus
        value={raw}
        onChange={e => setRaw(e.target.value)}
        onKeyDown={onKeyDown}
        leftAddon={<SearchIcon size={14} />}
        placeholder={t`Search this evaluator's past evaluations…`}
        data-testid="search-input"
        className="shrink-0"
      />

      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-2 min-h-0 flex-1">
        <div data-testid="search-results" className="min-h-0 overflow-y-auto border-r border-hairline pr-1.5 flex flex-col gap-1">
          {list.length === 0 ? (
            <div className="px-2.5 py-6 text-center text-[11.5px] text-muted leading-relaxed">
              {tooShort
                ? <Trans>Type at least {MIN_QUERY} characters.</Trans>
                : active
                  ? isFetching ? <Trans>Searching…</Trans> : <Trans>No matching evaluations.</Trans>
                  : <Trans>No past evaluations yet.</Trans>}
            </div>
          ) : (
            list.map(it => {
              const on = it.testCaseId === effectiveActiveId;
              return (
                <RowButton
                  key={it.testCaseId}
                  data-testid={`past-evaluation-result-${it.testCaseId}`}
                  onMouseEnter={() => setActiveId(it.testCaseId)}
                  onClick={() => onPick(it.testCaseId)}
                  className={cn(
                    'flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left border transition-colors',
                    on ? 'bg-card border-border' : 'border-transparent hover:bg-card',
                  )}
                >
                  <ScoreSquare score={it.score} size={22} />
                  <span className={cn('flex-1 min-w-0 block text-[12px] font-semibold truncate', on ? 'text-primary' : 'text-secondary')}>
                    {it.label}
                  </span>
                </RowButton>
              );
            })
          )}
        </div>

        <div className="min-h-0 overflow-y-auto pr-1">
          <PastEvaluationPreview evaluatorId={evaluatorId} evaluatorName={evaluatorName} caseId={effectiveActiveId} />
        </div>
      </div>
    </div>
  );
}
