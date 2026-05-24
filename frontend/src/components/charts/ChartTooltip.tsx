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
      className="absolute z-10 pointer-events-none whitespace-nowrap rounded-md px-2.5 py-1.5 text-[11px] shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)] border border-border backdrop-blur-[6px] bg-[color-mix(in_srgb,var(--bg-secondary)_95%,transparent)]"
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        transform,
      }}
    >
      {label && <div className="text-muted text-[10px] font-medium leading-tight">{label}</div>}
      <div className="flex items-center gap-1.5 mt-[1px]">
        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: color }} />
        <span className="font-semibold mono text-[11.5px] text-primary">{value}</span>
      </div>
    </div>
  );
}
