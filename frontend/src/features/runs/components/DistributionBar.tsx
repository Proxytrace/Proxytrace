import { Trans } from '@lingui/react/macro';
import type { HeatmapCell } from '../comparison';
import { SCORE_BUCKETS, scoreBucketColor } from '../comparison';
import { passRateColor } from '../results';
import { cn } from '../../../lib/cn';

/**
 * Stacked score-distribution bar for one evaluator × one model, with judged count + pass rate.
 * `leading` marks this model as the row's top scorer (in a multi-model comparison) — its pass rate
 * is shown in success green so the strongest model per evaluator reads at a glance.
 */
export function DistributionBar({ cell, leading = false }: { cell: HeatmapCell; leading?: boolean }) {
  if (cell.total === 0) return <span className="text-body-sm text-muted italic"><Trans>pending</Trans></span>;

  return (
    <div>
      <div className="flex h-[14px] rounded-sm overflow-hidden bg-white/[0.04] mb-1">
        {SCORE_BUCKETS.map(bucket => {
          const v = cell.dist[bucket];
          if (!v) return null;
          return (
            <div
              key={bucket}
              title={`${bucket}: ${v}`}
              className="flex items-center justify-center text-caption font-bold text-black/60"
              style={{ flexGrow: v, background: scoreBucketColor(bucket) }}
            >
              {v >= 2 ? v : ''}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-caption text-muted">
        <span><Trans>{cell.total} judged</Trans></span>
        <span
          className={cn('mono font-bold', leading && 'text-success')}
          style={leading ? undefined : { color: passRateColor(cell.passRate) }}
        >
          {cell.passRate === null ? '—' : `${cell.passRate}%`}
        </span>
      </div>
    </div>
  );
}
