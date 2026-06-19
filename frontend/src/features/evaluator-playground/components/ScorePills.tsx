import { Trans } from '@lingui/react/macro';
import { cn } from '../../../lib/cn';
import { type EvaluationScore } from '../../../api/models';
import { tint } from '../../../lib/colors';
import { scoreColor, scoreNumber } from '../testBenchMeta';
import { ArrowUpRightIcon } from '../../../components/icons';

/** Compact "n/5" chip tinted to the score band. */
export function ScoreChip({ score, size = 'sm' }: { score: EvaluationScore | null; size?: 'sm' | 'lg' }) {
  const color = scoreColor(score);
  const n = scoreNumber(score);
  const big = size === 'lg';
  return (
    <span
      className={cn(
        'inline-flex items-baseline gap-0.5 rounded-sm font-mono font-bold leading-none',
        big ? 'px-2.5 py-1 text-[15px]' : 'px-2 py-0.5 text-[12px]',
      )}
      style={{ background: tint(color, 16), color }}
    >
      {n ?? '—'}
      <span className="opacity-70 font-semibold" style={{ fontSize: big ? 10 : 8.5 }}>/5</span>
    </span>
  );
}

/** Signed 1–5 delta vs the previous session run. */
export function DeltaChip({ delta }: { delta: number | null }) {
  if (delta == null) return null;
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-body-sm text-muted font-mono"><Trans>= no change vs previous</Trans></span>
    );
  }
  const up = delta > 0;
  return (
    <span
      className={cn('inline-flex items-center gap-1 text-body-sm font-mono font-semibold', up ? 'text-success' : 'text-danger')}
    >
      <ArrowUpRightIcon size={11} className={up ? '' : 'rotate-180'} />
      <Trans>{up ? '+' : ''}{delta} vs previous</Trans>
    </span>
  );
}
