import { Card } from '../../../components/ui/Card';
import { cn } from '../../../lib/cn';
import { TONE_SUBTLE_BG, TONE_TEXT } from '../shared';
import { formatPValue, isInsideNoise } from '../theoryBoard';
import { formatDeltaPt, type GainSummary, type ReviewMeta } from '../validatedView';

interface Props {
  gain: GainSummary | null;
  pValue: number | null;
  review: ReviewMeta;
}

/** Lead card of a validated theory: the effective pass-rate gain plus the review status. */
export function GainHero({ gain, pValue, review }: Props) {
  return (
    <Card elevation="raised" padding="none" className="overflow-hidden" data-testid="gain-hero">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-hairline">
        <span className="text-caption text-muted font-semibold uppercase tracking-[0.07em]">Effective gain</span>
        <span className={cn('ml-auto inline-flex items-center rounded-full px-2 py-[2px] text-caption font-semibold', TONE_SUBTLE_BG[review.tone], TONE_TEXT[review.tone])}>
          {review.label}
        </span>
      </div>

      <div className="flex items-end gap-4 px-4 py-4">
        {gain ? (
          <>
            <span
              className={cn(
                'text-display font-bold tracking-[-0.02em] mono leading-none',
                gain.deltaPt != null && gain.deltaPt > 0 ? 'text-success' : 'text-secondary',
              )}
            >
              {gain.deltaPt != null ? formatDeltaPt(gain.deltaPt) : `${gain.toPct}%`}
            </span>
            <span className="mono text-body-sm text-secondary pb-0.5">
              {gain.fromPct != null ? `${gain.fromPct}% → ${gain.toPct}% pass rate` : 'pass rate after change'}
            </span>
          </>
        ) : (
          <span className="text-body-sm text-muted">No pass-rate metrics recorded.</span>
        )}
        {pValue != null && (
          <span className="mono ml-auto text-caption text-muted pb-0.5">
            {formatPValue(pValue)} · {isInsideNoise(pValue) ? 'inside noise' : 'significant'}
          </span>
        )}
      </div>
    </Card>
  );
}
