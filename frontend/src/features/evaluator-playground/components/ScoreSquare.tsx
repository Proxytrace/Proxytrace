import { useLingui } from '@lingui/react/macro';
import { type EvaluationScore } from '../../../api/models';
import { tint } from '../../../lib/colors';
import { scoreColor, scoreNumber } from '../testBenchMeta';

/** Score as a single colored square digit (1–5), em-dash when unscored. */
export function ScoreSquare({ score, size = 26 }: { score: EvaluationScore | null; size?: number }) {
  const { t } = useLingui();
  const color = scoreColor(score);
  const n = scoreNumber(score);
  return (
    <span
      aria-label={n != null ? t`Score ${n} of 5` : t`Not scored`}
      className="inline-flex items-center justify-center shrink-0 rounded-sm font-mono font-bold leading-none"
      style={{ width: size, height: size, fontSize: size * 0.5, background: tint(color, 16), color }}
    >
      {n ?? '—'}
    </span>
  );
}
