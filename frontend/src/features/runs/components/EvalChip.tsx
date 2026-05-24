import type { EvaluationResultDto } from '../../../api/models';
import { EVALUATOR_KIND_COLOR, tint } from '../../../lib/colors';
import { CheckIcon, XIcon } from '../../../components/icons';
import { isErrored, isEvalPass } from '../results';

export function EvalChip({ e }: { e: EvaluationResultDto }) {
  const c = EVALUATOR_KIND_COLOR[e.evaluatorKind] ?? 'var(--text-muted)';
  const errored = isErrored(e);
  const evalPass = isEvalPass(e);
  const accent = errored ? 'var(--warn)' : (evalPass ? c : 'var(--danger)');
  const title = errored ? `${e.evaluatorName}: error — ${e.errorMessage ?? ''}` : `${e.evaluatorName}: ${e.score}`;
  const label = errored ? `${e.evaluatorName} · error` : e.evaluatorName;
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 px-[7px] py-[2px] rounded-full text-caption font-semibold"
      style={{ background: tint(accent, 14), color: accent }}
    >
      {!errored && (evalPass ? <CheckIcon size={9} strokeWidth={2.5} /> : <XIcon size={9} strokeWidth={2.5} />)}
      {label}
    </span>
  );
}
