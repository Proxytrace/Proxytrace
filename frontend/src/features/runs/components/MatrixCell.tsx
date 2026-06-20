import { useLingui } from '@lingui/react/macro';
import type { MatrixCell } from '../results';
import { cn } from '../../../lib/cn';
import { fmtDuration } from '../../../lib/format';
import { FOCUS_RING } from '../../../lib/constants';
import { CheckIcon, XIcon } from '../../../components/icons';
import { RowButton } from '../../../components/ui/RowButton';
import { EvalSlots } from './EvalSlots';

/** Renders one (case × model) cell by lifecycle: finished verdict, live progress, or pending. */
export function MatrixCellContent({ cell, onCompare }: {
  cell: MatrixCell;
  onCompare: (runId: string) => void;
}) {
  const { t } = useLingui();
  if (cell.status === 'done' && cell.result) {
    const verdict = cell.pass === true ? t`pass` : cell.pass === false ? t`fail` : t`no verdict`;
    return (
      <RowButton
        onClick={() => onCompare(cell.run.id)}
        title={t`${cell.run.endpointName}: ${verdict} — click to compare`}
        className={cn('px-3 py-2.5 flex items-center gap-2 hover:bg-card-2 transition-colors duration-[var(--motion-fast)]', FOCUS_RING)}
      >
        {cell.pass === true ? <CheckIcon size={12} strokeWidth={2.5} className="text-success shrink-0" />
          : cell.pass === false ? <XIcon size={12} strokeWidth={2.5} className="text-danger shrink-0" /> : null}
        <EvalSlots arrived={cell.result.evaluations} total={cell.result.evaluations.length} />
        <span className="mono text-caption text-muted shrink-0">{fmtDuration(cell.result.durationMs)}</span>
      </RowButton>
    );
  }

  if (cell.status === 'running') {
    return (
      <span
        data-testid={`matrix-cell-running-${cell.run.id}`}
        title={t`${cell.run.endpointName}: evaluating…`}
        className="w-full px-3 py-2.5 flex items-center gap-2 text-muted"
      >
        <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-accent inline-block shrink-0" />
        <EvalSlots arrived={cell.liveEvaluations} total={cell.progress?.total ?? cell.liveEvaluations.length} />
        {cell.progress && cell.progress.total > 0 && (
          <span className="mono text-caption text-muted shrink-0">{cell.progress.done}/{cell.progress.total}</span>
        )}
      </span>
    );
  }

  // pending: show the evaluator slots greyed out so the cell isn't an empty dash
  return (
    <span
      data-testid={`matrix-cell-pending-${cell.run.id}`}
      title={t`${cell.run.endpointName}: queued`}
      className="w-full px-3 py-2.5 flex items-center gap-2 text-muted"
    >
      {cell.progress && cell.progress.total > 0
        ? <EvalSlots arrived={[]} total={cell.progress.total} />
        : <span>—</span>}
    </span>
  );
}
