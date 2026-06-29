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
    <div className="flex items-center gap-2 w-full">
      <div style={{ height, borderRadius: height }} className="flex-1 bg-card-2 overflow-hidden">
        <div style={{ width: `${pct}%`, borderRadius: height, background: color }} className="h-full transition-[width] duration-300" />
      </div>
      {showLabel && (
        <span className="text-body-sm font-semibold text-muted shrink-0 min-w-[32px]">
          {pct}%
        </span>
      )}
    </div>
  );
}
