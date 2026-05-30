import type { RunEvaluatorDto } from '../../../api/models';
import { EVALUATOR_KIND_COLOR } from '../../../lib/colors';

/** Explains the position-based evaluator dots painted on each {@link CaseTile}. */
export function CaseDotLegend({ evaluators }: { evaluators: RunEvaluatorDto[] }) {
  if (evaluators.length === 0) return null;

  return (
    <span data-testid="case-dot-legend" className="inline-flex items-center gap-2.5 pl-3 border-l border-hairline">
      <span className="text-caption font-semibold text-muted tracking-[0.07em]">Dots</span>
      {evaluators.map((ev, i) => (
        <span key={ev.id} className="inline-flex items-center gap-1.5 text-body-sm text-secondary">
          <span className="mono inline-flex items-center justify-center w-3.5 h-3.5 rounded-sm bg-white/[0.04] text-caption font-bold text-muted">
            {i + 1}
          </span>
          <span className="font-semibold" style={{ color: EVALUATOR_KIND_COLOR[ev.kind] }}>{ev.name}</span>
        </span>
      ))}
      <span className="text-caption text-muted">
        · <span className="text-success">green pass</span> · <span className="text-danger">red fail</span>
      </span>
    </span>
  );
}
