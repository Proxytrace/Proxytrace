import { Trans } from '@lingui/react/macro';
import { cn } from '../../../lib/cn';

type TagVariant = 'production' | 'baseline' | 'candidate';

const TAG_CLS: Record<TagVariant, string> = {
  production: cn('bg-success-subtle text-success border-[color-mix(in_srgb,var(--success)_35%,transparent)]'),
  baseline: cn('bg-card-2 text-secondary border-border'),
  candidate: cn('bg-card-2 text-muted border-border'),
};

/**
 * Role tag on a comparison card: the in-production baseline (success green, with a live pulse dot), a
 * fallback baseline (when the group has no deployed model), or a candidate being measured against it.
 */
export function ComparisonTag({ variant }: { variant: TagVariant }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-none border text-caption font-bold uppercase tracking-[0.08em] whitespace-nowrap',
        TAG_CLS[variant],
      )}
    >
      {variant === 'production' && <span aria-hidden className="pulse-dot w-[6px] h-[6px] rounded-full bg-success inline-block" />}
      {variant === 'production' ? <Trans>In production</Trans> : variant === 'baseline' ? <Trans>Baseline</Trans> : <Trans>Candidate</Trans>}
    </span>
  );
}
