interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  height?: number;
  showLabel?: boolean;
}

export function ProgressBar({ value, max = 100, color = 'var(--success)', height = 6, showLabel = false }: ProgressBarProps) {
  const pct = Math.min(100, Math.round((value / (max || 1)) * 100));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
      <div style={{ flex: 1, height, borderRadius: height, background: 'var(--bg-card-2)', overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: height,
          background: color, transition: 'width 0.3s ease',
        }} />
      </div>
      {showLabel && (
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', flexShrink: 0, minWidth: '32px' }}>
          {pct}%
        </span>
      )}
    </div>
  );
}
