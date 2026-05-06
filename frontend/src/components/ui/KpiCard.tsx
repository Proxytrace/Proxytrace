import { sparklinePath } from '../../lib/charts';
import { ArrowUpIcon, ArrowDownIcon } from '../icons';

interface KpiCardProps {
  icon?: React.ReactNode;
  label?: string;
  title?: string;
  value: string;
  sub?: string;
  subtitle?: string;
  trend?: string | { direction: 'up' | 'down'; pct: string; positive?: boolean };
  trendDir?: 'up' | 'down';
  sparkline?: number[];
  sparklineColor?: string;
  accent?: boolean;
}

function Sparkline({ data, color, width = 80, height = 36 }: { data: number[]; color: string; width?: number; height?: number }) {
  return (
    <svg width={width} height={height} className="shrink-0">
      <path
        d={sparklinePath(data, width, height)}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
    </svg>
  );
}

export function KpiCard({
  icon,
  label,
  title,
  value,
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
      style={{
        background: accent
          ? 'linear-gradient(155deg, rgba(201, 148, 74, 0.10), transparent 60%), var(--bg-card)'
          : 'var(--bg-card)',
        boxShadow: accent
          ? '0 1px 0 rgba(255,255,255,0.04) inset, 0 2px 4px rgba(0,0,0,0.25), 0 12px 32px -12px rgba(201, 148, 74, 0.25)'
          : 'var(--shadow-card)',
      }}
      className="rounded-2xl p-[18px] relative overflow-hidden"
    >
      {accent && (
        <div
          className="absolute top-[-30px] right-[-30px] w-[120px] h-[120px] rounded-full pointer-events-none bg-[radial-gradient(circle,rgba(201,148,74,0.16),transparent_70%)]"
        />
      )}

      <div className="flex items-center justify-between mb-3 relative">
        <div className="flex items-center gap-2">
          {icon && (
            <div
              className={`w-7 h-7 rounded-[7px] flex items-center justify-center ${
                accent ? 'bg-accent-subtle text-accent-hover' : 'bg-card-2 text-secondary'
              }`}
            >{icon}</div>
          )}
          <span className="text-xs text-secondary font-medium">{displayLabel}</span>
        </div>
        {trendText && (
          <div
            className={`flex items-center gap-0.5 text-[11px] font-semibold px-[6px] py-[2px] rounded-[5px] ${
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
          <div className="text-[28px] font-bold tracking-[-0.025em] leading-none">{value}</div>
          {displaySub && (
            <div className="text-[11.5px] text-muted mt-[6px]">{displaySub}</div>
          )}
        </div>
        {sparkline && sparkline.length > 1 && (
          <Sparkline data={sparkline} color={sparklineColor} />
        )}
      </div>
    </div>
  );
}
