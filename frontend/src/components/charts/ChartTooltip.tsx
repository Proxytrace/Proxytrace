interface ChartTooltipProps {
  leftPct: number;
  topPct: number;
  label?: string;
  value: string;
  color: string;
  align?: 'top' | 'side';
}

export function ChartTooltip({ leftPct, topPct, label, value, color, align = 'top' }: ChartTooltipProps) {
  const transform = align === 'top'
    ? 'translate(-50%, calc(-100% - 10px))'
    : 'translate(8px, -50%)';
  return (
    <div
      className="absolute z-10 pointer-events-none whitespace-nowrap px-2.5 py-1.5 text-body-sm border border-border bg-surface-2 shadow-[var(--shadow-float)]"
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        transform,
      }}
    >
      {label && <div className="text-muted text-caption font-medium leading-tight">{label}</div>}
      <div className="flex items-center gap-1.5 mt-0.25">
        <span className="w-1.5 h-1.5 inline-block" style={{ background: color }} />
        <span className="font-semibold mono text-body-sm text-primary">{value}</span>
      </div>
    </div>
  );
}
