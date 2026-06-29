import { Sparkline } from '../charts';
import { ArrowUpIcon, ArrowDownIcon } from '../icons';
import { cn } from '../../lib/cn';

interface KpiCardProps {
  icon?: React.ReactNode;
  label?: string;
  title?: string;
  value: string;
  valueColor?: string;
  sub?: string;
  subtitle?: string;
  trend?: string | { direction: 'up' | 'down'; pct: string; positive?: boolean };
  trendDir?: 'up' | 'down';
  sparkline?: number[];
  sparklineColor?: string;
  accent?: boolean;
}

export function KpiCard({
  icon,
  label,
  title,
  value,
  valueColor,
  sub,
  subtitle,
  trend,
  trendDir,
  sparkline,
  sparklineColor = 'var(--accent-primary)',
  accent = false,
}: KpiCardProps) {
  const displayLabel = label ?? title ?? '';
  const displaySub = sub ?? subtitle;

  let trendText: string | undefined;
  let trendDirection: 'up' | 'down' | undefined;

  if (typeof trend === 'string') {
    trendText = trend;
    trendDirection = trendDir;
  } else if (trend && typeof trend === 'object') {
    trendText = trend.pct;
    if (trend.positive !== false) {
      trendDirection = trend.direction === 'up' ? 'up' : 'down';
    } else {
      trendDirection = trend.direction === 'down' ? 'up' : 'down';
    }
  }

  return (
    <div
      className={cn(
        'rounded-xl p-5 relative overflow-hidden',
        accent
          ? 'bg-[linear-gradient(155deg,var(--accent-subtle),transparent_60%),var(--bg-card)] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_2px_4px_rgba(0,0,0,0.25),0_12px_32px_-12px_var(--accent-glow)]'
          : 'bg-card shadow-[var(--shadow-card)]',
      )}
    >
      {accent && (
        <div
          className="absolute top-[-30px] right-[-30px] w-[120px] h-[120px] rounded-full pointer-events-none bg-[radial-gradient(circle,var(--accent-glow),transparent_70%)]"
        />
      )}

      <div className="flex items-center justify-between mb-3 relative">
        <div className="flex items-center gap-2">
          {icon && (
            <div
              className={`w-7 h-7 rounded-sm flex items-center justify-center ${
                accent ? 'bg-accent-subtle text-accent-hover' : 'bg-card-2 text-secondary'
              }`}
            >{icon}</div>
          )}
          <span className="text-body-sm text-secondary font-medium">{displayLabel}</span>
        </div>
        {trendText && (
          <div
            className={`flex items-center gap-0.5 text-body-sm font-semibold px-1.5 py-0.5 rounded-sm ${
              trendDirection === 'up'
                ? 'text-success bg-success-subtle'
                : 'text-danger bg-danger-subtle'
            }`}
          >
            {trendDirection === 'up' ? (
              <ArrowUpIcon size={10} strokeWidth={2.5} />
            ) : (
              <ArrowDownIcon size={10} strokeWidth={2.5} />
            )}
            {trendText}
          </div>
        )}
      </div>

      <div className="flex items-end justify-between relative">
        <div>
          <div className="text-display font-bold tracking-[-0.025em] leading-none" style={valueColor ? { color: valueColor } : undefined}>{value}</div>
          {displaySub && (
            <div className="text-body-sm text-muted mt-1.5">{displaySub}</div>
          )}
        </div>
        {sparkline && sparkline.length > 1 && (
          <Sparkline data={sparkline} color={sparklineColor} />
        )}
      </div>
    </div>
  );
}
