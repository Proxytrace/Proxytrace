import type { EvaluationResultDto } from '../../../api/models';
import type { MatrixCell } from '../results';
import { isErrored, isEvalPass } from '../results';
import { cn } from '../../../lib/cn';
import { fmtDuration } from '../../../lib/format';
import { FOCUS_RING } from '../../../lib/constants';
import { CheckIcon, XIcon } from '../../../components/icons';
import { RowButton } from '../../../components/ui/RowButton';

/** Renders one (case × model) cell by lifecycle: finished verdict, live progress, or pending. */
export function MatrixCellContent({ cell, onCompare }: {
  cell: MatrixCell;
  onCompare: (runId: string) => void;
}) {
  if (cell.status === 'done' && cell.result) {
    const verdict = cell.pass === true ? 'pass' : cell.pass === false ? 'fail' : 'no verdict';
    return (
      <RowButton
        onClick={() => onCompare(cell.run.id)}
        title={`${cell.run.endpointName}: ${verdict} — click to compare`}
        className={cn('px-3 py-2.5 flex items-center gap-2 hover:bg-card-2 transition-colors duration-[var(--motion-fast)]', FOCUS_RING)}
      >
        {cell.pass === true ? <CheckIcon size={12} strokeWidth={2.5} className="text-success shrink-0" />
          : cell.pass === false ? <XIcon size={12} strokeWidth={2.5} className="text-danger shrink-0" /> : null}
        <EvalDots evaluations={cell.result.evaluations} />
        <span className="mono text-caption text-muted shrink-0">{fmtDuration(cell.result.durationMs)}</span>
      </RowButton>
    );
  }

  if (cell.status === 'running') {
    return (
      <span
        data-testid={`matrix-cell-running-${cell.run.id}`}
        title={`${cell.run.endpointName}: evaluating…`}
        className="w-full px-3 py-2.5 flex items-center gap-2 text-muted"
      >
        <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-accent inline-block shrink-0" />
        <EvalDots evaluations={cell.liveEvaluations} />
        {cell.progress && cell.progress.total > 0 && (
          <span className="mono text-caption text-muted shrink-0">{cell.progress.done}/{cell.progress.total}</span>
        )}
      </span>
    );
  }

  return <span className="w-full px-3 py-2.5 flex items-center text-muted">—</span>;
}

/** One dot per evaluator (left→right = arrival/suite order), colored pass/fail/error. */
export function EvalDots({ evaluations }: { evaluations: EvaluationResultDto[] }) {
  return (
    <span className="flex items-center gap-1">
      {evaluations.map((e, i) => (
        <span
          key={i}
          title={`${e.evaluatorName}: ${isErrored(e) ? 'error' : isEvalPass(e) ? 'pass' : 'fail'}`}
          className={cn('w-2 h-2 rounded-full shrink-0', isErrored(e) ? 'bg-warn' : isEvalPass(e) ? 'bg-success' : 'bg-danger')}
        />
      ))}
    </span>
  );
}
