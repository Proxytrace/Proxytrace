import { sparklinePath } from '../../lib/charts';

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
    <svg width={width} height={height} style={{ flexShrink: 0 }}>
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
  // Support both old API (title/subtitle/trend object) and new API (label/sub/trend string/trendDir)
  const displayLabel = label ?? title ?? '';
  const displaySub = sub ?? subtitle;

  // Normalize trend
  let trendText: string | undefined;
  let trendDirection: 'up' | 'down' | undefined;

  if (typeof trend === 'string') {
    trendText = trend;
    trendDirection = trendDir;
  } else if (trend && typeof trend === 'object') {
    trendText = trend.pct;
    // For old API: positive + direction determine color
    if (trend.positive !== false) {
      trendDirection = trend.direction === 'up' ? 'up' : 'down';
    } else {
      trendDirection = trend.direction === 'down' ? 'up' : 'down';
    }
  }

  return (
    <div style={{
      background: accent
        ? 'linear-gradient(155deg, rgba(201, 148, 74, 0.10), transparent 60%), var(--bg-card)'
        : 'var(--bg-card)',
      borderRadius: 16, padding: 18, position: 'relative', overflow: 'hidden',
      boxShadow: accent
        ? '0 1px 0 rgba(255,255,255,0.04) inset, 0 2px 4px rgba(0,0,0,0.25), 0 12px 32px -12px rgba(201, 148, 74, 0.25)'
        : 'var(--shadow-card)',
    }}>
      {/* Radial glow in top-right for accent */}
      {accent && (
        <div style={{
          position: 'absolute', top: -30, right: -30, width: 120, height: 120,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(201, 148, 74, 0.16), transparent 70%)',
          pointerEvents: 'none',
        }} />
      )}

      {/* Header row: icon+label on left, trend badge on right */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon && (
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: accent ? 'var(--accent-subtle)' : 'var(--bg-card-2)',
              color: accent ? 'var(--accent-hover)' : 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{icon}</div>
          )}
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{displayLabel}</span>
        </div>
        {trendText && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 2,
            fontSize: 11, fontWeight: 600,
            color: trendDirection === 'up' ? 'var(--success)' : 'var(--danger)',
            padding: '2px 6px', borderRadius: 5,
            background: trendDirection === 'up' ? 'var(--success-subtle)' : 'var(--danger-subtle)',
          }}>
            {trendDirection === 'up' ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
              </svg>
            )}
            {trendText}
          </div>
        )}
      </div>

      {/* Value + sparkline row */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', position: 'relative' }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1 }}>{value}</div>
          {displaySub && (
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>{displaySub}</div>
          )}
        </div>
        {sparkline && sparkline.length > 1 && (
          <Sparkline data={sparkline} color={sparklineColor} />
        )}
      </div>
    </div>
  );
}
