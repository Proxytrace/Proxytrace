import type { EvaluationResultDto } from '../../../api/models';
import { isErrored, isEvalPass } from '../results';
import { cn } from '../../../lib/cn';

/**
 * One dot per evaluator. Arrived evaluations are colored by verdict (pass/fail/error);
 * the remaining `total − arrived` slots render as muted placeholders so a cell shows its
 * evaluator count from the moment it starts — progress fills left→right as events stream in.
 */
export function EvalSlots({ arrived, total }: { arrived: EvaluationResultDto[]; total: number }) {
  const emptyCount = Math.max(0, total - arrived.length);
  return (
    <span className="flex items-center gap-1" data-testid="eval-slots">
      {arrived.map(e => (
        <span
          key={e.evaluatorId}
          title={`${e.evaluatorName}: ${isErrored(e) ? 'error' : isEvalPass(e) ? 'pass' : 'fail'}`}
          className={cn('w-2 h-2 rounded-full shrink-0', isErrored(e) ? 'bg-warn' : isEvalPass(e) ? 'bg-success' : 'bg-danger')}
        />
      ))}
      {Array.from({ length: emptyCount }).map((_, i) => (
        <span
          key={`e${i}`}
          aria-hidden
          data-testid="eval-slot-empty"
          className="w-2 h-2 rounded-full shrink-0 bg-[var(--text-muted)] opacity-30"
        />
      ))}
    </span>
  );
}
