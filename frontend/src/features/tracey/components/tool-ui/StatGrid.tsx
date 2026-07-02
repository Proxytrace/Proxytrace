import { Skeleton } from '../../../../components/ui/Skeleton';
import { cn } from '../../../../lib/cn';

/** Semantic emphasis for a figure whose meaning is fixed (pass/fail/health). */
export type StatTone = 'success' | 'warn' | 'danger' | 'accent';

export interface StatItem {
  label: string;
  value: string;
  /** Optional caption under the value (a unit, a period, a qualifier). */
  sub?: string;
  /** Semantic color for the value (e.g. via `passRateTone`); omit for the neutral treatment. */
  tone?: StatTone;
}

const TONE_CLS: Record<StatTone, string> = {
  success: cn('text-success'),
  warn: cn('text-warn'),
  danger: cn('text-danger'),
  accent: cn('text-accent-text'),
};

const GRID_CLS = cn('grid grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] gap-1.5');

/** A compact, responsive grid of KPI tiles used by the stats tool cards. */
export function StatGrid({ items }: { items: StatItem[] }) {
  return (
    <div className={GRID_CLS}>
      {items.map((item, index) => (
        <div
          key={item.label}
          className="fade-up flex flex-col gap-0.5 rounded-md bg-card-2 px-2.5 py-2"
          style={{ animationDelay: `${index * 30}ms` }}
        >
          <span className="truncate text-caption uppercase tracking-[0.06em] text-muted" title={item.label}>
            {item.label}
          </span>
          <span
            className={cn(
              'font-mono text-h1 font-semibold tabular-nums',
              item.tone ? TONE_CLS[item.tone] : 'text-primary',
            )}
          >
            {item.value}
          </span>
          {item.sub && <span className="truncate text-caption text-muted">{item.sub}</span>}
        </div>
      ))}
    </div>
  );
}

/** Loading placeholder matching {@link StatGrid}'s tile layout. */
export function StatGridSkeleton({ count }: { count: number }) {
  return (
    <div className={GRID_CLS}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-1.5 rounded-md bg-card-2 px-2.5 py-2">
          <Skeleton width={48} height={10} />
          <Skeleton width={64} height={20} />
        </div>
      ))}
    </div>
  );
}
