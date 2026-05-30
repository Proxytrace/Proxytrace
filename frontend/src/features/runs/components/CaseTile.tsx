import type { TestResultDto } from '../../../api/models';
import { FOCUS_RING, ID_SHORT_LEN } from '../../../lib/constants';
import { cn } from '../../../lib/cn';
import { fmtDuration } from '../../../lib/format';
import { resultPass, resultScore, isErrored, isEvalPass } from '../results';

/**
 * Pass/fail-tinted tile for one test-case result: a row of position-based evaluator
 * dots + an overall verdict dot, the composite score with a fill bar, and the latency
 * plus a PASS/FAIL tag. Full detail lives in the click-through fixture drawer.
 */
export function CaseTile({ r, isSelected, onClick }: { r: TestResultDto; isSelected: boolean; onClick: () => void }) {
  const pass = resultPass(r);
  const score = resultScore(r);

  const bgCls = pass === true
    ? 'bg-[color-mix(in_srgb,var(--success)_10%,transparent)]'
    : pass === false
      ? 'bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]'
      : 'bg-card-2';
  const borderCls = isSelected
    ? (pass === true ? 'border-[color-mix(in_srgb,var(--success)_60%,transparent)]'
        : pass === false ? 'border-[color-mix(in_srgb,var(--danger)_60%,transparent)]'
          : 'border-[var(--text-primary)]')
    : (pass === true ? 'border-[color-mix(in_srgb,var(--success)_32%,transparent)]'
        : pass === false ? 'border-[color-mix(in_srgb,var(--danger)_34%,transparent)]'
          : 'border-hairline');
  const scoreCls = pass === true ? 'text-success' : pass === false ? 'text-danger' : 'text-muted';
  const fillCls = pass === true ? 'bg-success' : pass === false ? 'bg-danger' : 'bg-[var(--text-muted)]';
  const tagCls = pass
    ? 'bg-[color-mix(in_srgb,var(--success)_16%,transparent)] text-success'
    : 'bg-[color-mix(in_srgb,var(--danger)_16%,transparent)] text-danger';

  return (
    <button
      onClick={onClick}
      data-testid={`case-tile-${r.testCaseId}`}
      data-case-state={pass === true ? 'pass' : pass === false ? 'fail' : 'none'}
      title={`${r.testCaseId.slice(0, ID_SHORT_LEN)} · ${r.testCaseSummary}`}
      aria-label={`${r.testCaseSummary} — ${pass === true ? 'passed' : pass === false ? 'failed' : 'no result'}`}
      className={cn(
        'aspect-square flex flex-col justify-between gap-1 rounded-md border p-2 text-left overflow-hidden cursor-pointer',
        'transition-[background,border-color,box-shadow] duration-[var(--motion-fast)] hover:shadow-[var(--shadow-card)]',
        bgCls, borderCls, isSelected && 'shadow-[var(--shadow-card)]', FOCUS_RING,
      )}
    >
      {/* Top: one dot per evaluator (left→right matches the suite order) + overall verdict dot */}
      <div className="flex items-center gap-[3px]">
        {r.evaluations.map(e => (
          <span
            key={e.evaluatorId}
            title={`${e.evaluatorName}: ${isErrored(e) ? 'error' : isEvalPass(e) ? 'pass' : 'fail'}`}
            className={cn('w-1.5 h-1.5 rounded-full shrink-0', isErrored(e) ? 'bg-warn' : isEvalPass(e) ? 'bg-success' : 'bg-danger')}
          />
        ))}
        {pass !== null && (
          <span className={cn('ml-auto w-1 h-1 rounded-full opacity-60', pass ? 'bg-success' : 'bg-danger')} />
        )}
      </div>

      {/* Middle: composite score + fill bar */}
      <div className="flex flex-col items-start gap-1">
        <span className={cn('mono text-h1 font-bold leading-none', scoreCls)}>
          {score !== null ? score.toFixed(2) : '—'}
        </span>
        <div className="w-full h-[3px] rounded-full bg-white/[0.06] overflow-hidden">
          <div className={cn('h-full rounded-full', fillCls)} style={{ width: `${Math.max(0, Math.min(1, score ?? 0)) * 100}%` }} />
        </div>
      </div>

      {/* Bottom: latency + verdict tag */}
      <div className="flex items-center justify-between gap-1 mono text-caption text-muted">
        <span className="truncate">{fmtDuration(r.durationMs)}</span>
        {pass !== null && (
          <span className={cn('shrink-0 px-1 rounded-sm text-caption font-bold tracking-[0.06em]', tagCls)}>
            {pass ? 'PASS' : 'FAIL'}
          </span>
        )}
      </div>
    </button>
  );
}

/** Square placeholder for a case that has not produced a result yet. */
export function PendingTile({ summary, caseId, running }: { summary: string; caseId: string; running: boolean }) {
  return (
    <div
      title={`${summary} — ${running ? 'running…' : 'pending'}`}
      className={cn(
        'aspect-square flex flex-col items-center justify-center gap-1.5 rounded-md border border-dashed px-2',
        running
          ? 'border-[color-mix(in_srgb,var(--accent-primary)_38%,transparent)] bg-[color-mix(in_srgb,var(--accent-primary)_5%,transparent)]'
          : 'border-hairline opacity-50',
      )}
    >
      <span className={cn('w-[7px] h-[7px] rounded-full', running ? 'pulse-dot bg-accent' : 'bg-[var(--text-muted)]')} />
      <span className="mono text-caption text-muted">{caseId.slice(0, ID_SHORT_LEN)}</span>
      <span className={cn('text-caption', running ? 'text-accent-hover' : 'text-muted')}>{running ? 'running' : 'pending'}</span>
    </div>
  );
}
