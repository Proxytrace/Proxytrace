/**
 * Floating tooltip for the hovered chart point. Positioned in percentage space over the chart's
 * relative wrapper so it tracks the SVG as it scales responsively. Rendered as HTML (not SVG
 * <text>) for crisp typography and token-driven styling.
 */
export function ChartTooltip({
  label,
  value,
  leftPct,
  topPct,
}: {
  label: string;
  value: string;
  leftPct: number;
  topPct: number;
}) {
  // Clamp horizontally so the bubble never overflows the card edge.
  const left = Math.min(Math.max(leftPct, 8), 92);
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+8px)] whitespace-nowrap rounded-md border border-border bg-surface-2 px-2 py-1 shadow-[var(--shadow-float)]"
      style={{ left: `${left}%`, top: `${topPct}%` }}
    >
      <div className="max-w-[180px] truncate text-body-sm text-muted">{label}</div>
      <div className="font-mono text-title font-semibold tabular-nums text-primary">{value}</div>
    </div>
  );
}
