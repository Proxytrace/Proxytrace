import { Trans } from '@lingui/react/macro';
import { cachedPct } from '../../lib/format';
import { cn } from '../../lib/cn';

interface Props {
  /** Cached subset of the input tokens (cached ≤ input). */
  cachedInput: number;
  /** Total input tokens. */
  input: number;
  /** Render "N% cached" alone (for a sub-line) instead of the inline " (N% cached)" parenthetical. */
  bare?: boolean;
  className?: string;
  'data-testid'?: string;
}

/**
 * Muted "(N% cached)" hint shown beside an input-token figure. Renders nothing when none of the
 * input was served from cache — so callers can drop it in unconditionally.
 */
export function CachedTokensHint({ cachedInput, input, bare, className, 'data-testid': testId }: Props) {
  const pct = cachedPct(cachedInput, input);
  if (pct === null) return null;
  return (
    <span className={cn('text-muted', className)} data-testid={testId}>
      {bare ? <Trans>{pct}% cached</Trans> : <>{' '}(<Trans>{pct}% cached</Trans>)</>}
    </span>
  );
}
