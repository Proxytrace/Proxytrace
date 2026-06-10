import type { EvaluatorListItemDto } from '../../../api/models';
import { RailMonogram } from './RailMonogram';
import type { SessionRun } from '../hooks/usePlaygroundSession';

/** The judge's written verdict for the current run — reasoning, or an error/empty note. */
export function ReasoningCard({ evaluator, run }: { evaluator: EvaluatorListItemDto; run: SessionRun }) {
  const { result } = run;

  if (result.errorMessage) {
    return (
      <div className="rounded-lg p-4 border border-[color-mix(in_srgb,var(--danger)_22%,transparent)] bg-[var(--danger-subtle)]">
        <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-danger mb-1.5">Evaluator error</div>
        <div className="text-[12.5px] leading-relaxed text-danger whitespace-pre-wrap">{result.errorMessage}</div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg p-4 border border-border-subtle">
      <div className="flex items-center gap-2 mb-2.5">
        <RailMonogram name={evaluator.name} kind={evaluator.kind} size={22} />
        <span className="text-title font-semibold">{evaluator.name}&rsquo;s reasoning</span>
      </div>
      {result.reasoning ? (
        <div className="text-[13.5px] leading-relaxed text-primary">&ldquo;{result.reasoning}&rdquo;</div>
      ) : (
        <div className="text-[12.5px] leading-relaxed text-muted italic">
          This evaluator kind returns a score without written reasoning.
        </div>
      )}
    </div>
  );
}
