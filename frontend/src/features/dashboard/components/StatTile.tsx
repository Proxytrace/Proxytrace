// A single hero/2×2 KPI stat tile with an optional sparkline.

import { MiniArea } from '../../../components/charts';
import { cn } from '../../../lib/cn';

interface StatTileProps {
  icon: React.ReactNode;
  label: string;
  value: string;
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
  return (
    <div
      data-testid={testId}
      className={cn(
        'relative overflow-hidden rounded-xl px-3 pt-[10px] flex flex-col gap-[5px] min-h-[88px] bg-card shadow-[var(--shadow-card)]',
        accent && 'bg-[image:linear-gradient(155deg,var(--accent-subtle),transparent_55%)]',
      )}
    >
      {accent && (
        <div className="absolute -top-10 -right-10 w-[140px] h-[140px] rounded-full pointer-events-none bg-[radial-gradient(circle,var(--accent-subtle),transparent_65%)]" />
      )}
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-[7px]">
          <div className={`w-5 h-5 rounded-sm flex items-center justify-center ${accent ? 'bg-accent-subtle text-accent-hover' : 'bg-card-2 text-secondary'}`}>
            {icon}
          </div>
          <span className="text-[9.5px] text-muted font-bold tracking-[0.10em] uppercase font-mono">{label}</span>
        </div>
        {delta && (
          <span className={`text-[9.5px] font-bold font-mono inline-flex items-center gap-[3px] px-1.5 py-px rounded-sm ${deltaUp ? 'text-success bg-success-subtle' : 'text-danger bg-danger-subtle'}`}>
            <span className="text-[7.5px]">{deltaUp ? '▲' : '▼'}</span> {delta}
          </span>
        )}
      </div>
      <div className="relative">
        <div className="flex items-baseline gap-1">
          <span data-testid={testId ? `${testId}-value` : undefined} className="text-[24px] font-extrabold tracking-[-0.03em] leading-[0.92] tabular-nums text-primary">{value}</span>
          {unit && <span className="text-[11.5px] font-semibold text-muted">{unit}</span>}
        </div>
        <div className="text-[9.5px] text-muted mt-[3px] font-mono">{sub}</div>
      </div>
      {trace && trace.length >= 2 && (
        <div className="mt-auto -mx-3 relative">
          <MiniArea data={trace} color={traceColor} height={26} fillOpacity={accent ? 0.22 : 0.14} formatValue={traceFormat} />
        </div>
      )}
    </div>
  );
}
