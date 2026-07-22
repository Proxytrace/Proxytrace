// A single hero/2×2 KPI stat tile with an optional sparkline.

import { MiniArea } from '../../../components/charts';
import { cn } from '../../../lib/cn';
import { useCountUp } from '../../../hooks/useCountUp';
import { COL_HEADER_CLS } from '../dashboardMeta';

interface StatTileProps {
  icon: React.ReactNode;
  /** Pre-formatted display value. Ignored when `countTo`/`formatCount` drive an animated value. */
  value: string;
  /** Numeric target for the load-reveal count-up; pair with `formatCount`. */
  countTo?: number;
  /** Formats the animated number for display (e.g. `n => Math.round(n).toLocaleString()`). */
  formatCount?: (n: number) => string;
  label: string;
  unit?: string;
  sub: string;
  delta?: string;
  deltaUp?: boolean;
  trace?: number[];
  traceColor: string;
  traceFormat?: (v: number) => string;
  accent?: boolean;
  testId?: string;
}

export function StatTile({
  icon,
  label,
  value,
  countTo,
  formatCount,
  unit,
  sub,
  delta,
  deltaUp = true,
  trace,
  traceColor,
  traceFormat,
  accent = false,
  testId,
}: StatTileProps) {
  const animated = useCountUp(countTo ?? 0);
  const displayValue = countTo !== undefined && formatCount ? formatCount(animated) : value;
  return (
    <div
      data-testid={testId}
      className={cn(
        'rounded-xl px-3 pt-2.5 flex flex-col gap-1.5 min-h-[88px] bg-card shadow-[var(--shadow-card)]',
        accent && 'bg-[color-mix(in_srgb,var(--accent-primary)_8%,var(--bg-card))]',
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className={cn('w-5 h-5 rounded-sm flex items-center justify-center', accent ? 'bg-accent-subtle text-accent-hover' : 'bg-card-2 text-secondary')}>
            {icon}
          </div>
          <span className={COL_HEADER_CLS}>{label}</span>
        </div>
        {delta && (
          <span className={cn('text-caption font-bold font-mono inline-flex items-center gap-0.5 px-1.5 py-px rounded-sm', deltaUp ? 'text-success bg-success-subtle' : 'text-danger bg-danger-subtle')}>
            <span className="text-caption">{deltaUp ? '▲' : '▼'}</span> {delta}
          </span>
        )}
      </div>
      <div className="relative">
        <div className="flex items-baseline gap-1">
          <span data-testid={testId ? `${testId}-value` : undefined} className="text-h1 font-bold tracking-[-0.03em] leading-[0.92] tabular-nums text-primary">{displayValue}</span>
          {unit && <span className="text-body-sm font-semibold text-muted">{unit}</span>}
        </div>
        <div className="text-caption text-muted mt-0.5 font-mono">{sub}</div>
      </div>
      {trace && trace.length >= 2 && (
        <div className="mt-auto -mx-3 relative">
          <MiniArea data={trace} color={traceColor} height={26} fillOpacity={accent ? 0.22 : 0.14} formatValue={traceFormat} />
        </div>
      )}
    </div>
  );
}
