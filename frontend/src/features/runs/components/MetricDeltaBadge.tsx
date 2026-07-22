import type { ReactNode } from 'react';
import { cn } from '../../../lib/cn';

/**
 * Colored delta badge for a candidate metric vs the baseline: green tint when the candidate wins the
 * axis, red when it loses, muted (no fill) when tied or not comparable. The caller formats the text.
 */
export function MetricDeltaBadge({ better, children }: { better: boolean | null; children: ReactNode }) {
  return (
    <span
      className={cn(
        'mono text-body-sm font-bold whitespace-nowrap rounded-sm',
        better === null
          ? 'text-muted'
          : better
            ? 'px-1.5 py-0.5 bg-[color-mix(in_srgb,var(--success)_14%,transparent)] text-success'
            : 'px-1.5 py-0.5 bg-[color-mix(in_srgb,var(--danger)_14%,transparent)] text-danger',
      )}
    >
      {children}
    </span>
  );
}
