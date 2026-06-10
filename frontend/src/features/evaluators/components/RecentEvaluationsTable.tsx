import { cn } from '../../../lib/cn';
import { fmtRelative, fmtLatency } from '../../../lib/format';
import { ActivityIcon, XIcon, ExternalLinkIcon } from '../../../components/icons';
import { Button } from '../../../components/ui/Button';
import { RowButton } from '../../../components/ui/RowButton';
import type { RecentEvaluationItemDto } from '../../../api/evaluators';
import type { EvaluationScore } from '../../../api/models';
import { SCORE_LABEL } from '../evaluatorMeta';

const GRID = 'grid grid-cols-[90px_1fr_70px_70px_70px]';

interface Props {
  rows: RecentEvaluationItemDto[];
  isLoading: boolean;
  scoreFilter: EvaluationScore | null;
  onClearFilter: () => void;
  onOpenResult: (row: RecentEvaluationItemDto) => void;
}

/** Recent evaluations table for one evaluator (last 8). Data is supplied by the parent detail view. */
export function RecentEvaluationsTable({ rows, isLoading, scoreFilter, onClearFilter, onOpenResult }: Props) {
  return (
    <section className="bg-card rounded-lg shadow-[var(--shadow-card)] overflow-hidden">
      <header className="flex items-center gap-2.5 px-4 py-3 border-b border-hairline">
        <ActivityIcon size={13} />
        <span className="text-[10px] text-muted uppercase tracking-[0.09em] font-semibold">Recent evaluations</span>
        {!scoreFilter && <span className="text-[11px] text-muted">last 8</span>}
        {scoreFilter && (
          // eslint-disable-next-line no-restricted-syntax -- bespoke removable filter pill
          <button
            type="button"
            onClick={onClearFilter}
            data-testid="evaluator-recent-filter-clear"
            className="ml-auto inline-flex items-center gap-1 px-2 py-[3px] rounded-full bg-accent-subtle text-accent-text text-[10px] font-semibold cursor-pointer transition-colors hover:bg-card-2"
          >
            {SCORE_LABEL[scoreFilter]}
            <XIcon size={10} />
          </button>
        )}
      </header>
      {isLoading ? (
        <div className="px-4 py-8 text-center text-muted text-[12px]">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="px-4 py-10 text-center text-muted text-[12px]">
          {scoreFilter ? (
            <>
              No recent <strong>{SCORE_LABEL[scoreFilter]}</strong> evaluations.{' '}
              <Button variant="link" size="sm" onClick={onClearFilter}>Clear filter</Button>
            </>
          ) : (
            'No evaluations yet. Attach this evaluator to a suite and run it.'
          )}
        </div>
      ) : (
        <div>
          <div className={cn(GRID, 'px-4 py-2 gap-3 items-center text-[9.5px] text-muted uppercase tracking-[0.08em] border-b border-hairline font-semibold')}>
            <span>Time</span>
            <span>Case · reason</span>
            <span className="text-right">Latency</span>
            <span className="text-right">Score</span>
            <span className="text-right">Verdict</span>
          </div>
          {rows.map((s, i) => {
            const clickable = !!s.runId;
            return (
              <RowButton
                key={s.testResultId}
                disabled={!clickable}
                onClick={() => onOpenResult(s)}
                data-testid={`evaluator-recent-row-${s.testResultId}`}
                title={clickable ? 'Open this result in the run matrix' : undefined}
                className={cn(
                  GRID,
                  'group px-4 py-[11px] items-center gap-3 text-[11.5px] transition-colors',
                  i < rows.length - 1 && 'border-b border-hairline',
                  clickable ? 'hover:bg-card-2' : 'cursor-default',
                )}
              >
                <span className="text-muted text-left">{fmtRelative(s.evaluatedAt)}</span>
                <div className="min-w-0 text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-primary overflow-hidden text-ellipsis whitespace-nowrap">{s.caseSummary}</span>
                    {clickable && <ExternalLinkIcon size={10} className="text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />}
                  </div>
                  {s.reasoning && (
                    <div className="text-[10.5px] text-muted overflow-hidden text-ellipsis whitespace-nowrap">{s.reasoning}</div>
                  )}
                </div>
                <span className="text-right font-mono text-muted text-[11px]">{s.latencyMs ? fmtLatency(s.latencyMs) : '—'}</span>
                <span className="text-right font-mono font-semibold text-primary">{s.score ?? '—'}</span>
                <span className="text-right">
                  <span className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-[0.04em]',
                    s.passed ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger',
                  )}>{s.passed ? 'PASS' : 'FAIL'}</span>
                </span>
              </RowButton>
            );
          })}
        </div>
      )}
    </section>
  );
}
