import { cn } from '../../../lib/cn';
import { fmtRelative, fmtLatency } from '../../../lib/format';
import { ActivityIcon } from '../../../components/icons';
import type { RecentEvaluationItemDto } from '../../../api/evaluators';

const GRID = 'grid grid-cols-[90px_1fr_70px_70px_70px]';

interface Props {
  rows: RecentEvaluationItemDto[];
  isLoading: boolean;
}

/** Recent evaluations table for one evaluator (last 8). Data is supplied by the parent detail view. */
export function RecentEvaluationsTable({ rows, isLoading }: Props) {
  return (
    <section className="bg-card rounded-lg shadow-[var(--shadow-card)] overflow-hidden">
      <header className="flex items-center gap-2.5 px-4 py-3 border-b border-hairline">
        <ActivityIcon size={13} />
        <span className="text-[10px] text-muted uppercase tracking-[0.09em] font-semibold">Recent evaluations</span>
        <span className="text-[11px] text-muted">last 8</span>
      </header>
      {isLoading ? (
        <div className="px-4 py-8 text-center text-muted text-[12px]">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="px-4 py-10 text-center text-muted text-[12px]">
          No evaluations yet. Attach this evaluator to a suite and run it.
        </div>
      ) : (
        <div>
          <div className={cn(GRID, 'px-4 py-2 text-[9.5px] text-muted uppercase tracking-[0.08em] border-b border-hairline font-semibold')}>
            <span>Time</span>
            <span>Case · reason</span>
            <span className="text-right">Latency</span>
            <span className="text-right">Score</span>
            <span className="text-right">Verdict</span>
          </div>
          {rows.map((s, i) => (
            <div
              key={s.testResultId}
              className={cn(GRID, 'px-4 py-[11px] items-center gap-3 text-[11.5px]', i < rows.length - 1 && 'border-b border-hairline')}
            >
              <span className="text-muted">{fmtRelative(s.evaluatedAt)}</span>
              <div className="min-w-0">
                <div className="font-medium text-primary overflow-hidden text-ellipsis whitespace-nowrap">{s.caseSummary}</div>
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
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
