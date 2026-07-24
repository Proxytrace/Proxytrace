/** A single KPI tile inside the stats block; left bar tinted by the runtime `color`. */
export function StatsBlockKpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      className="bg-card-2 rounded-md px-3.5 py-3 border-l-2"
      style={{ borderLeftColor: `color-mix(in srgb, ${color} 38%, transparent)` }}
    >
      <div className="text-caption text-secondary uppercase tracking-[0.06em] font-semibold mb-1.5">{label}</div>
      <div className="text-display-sm font-bold font-mono tracking-[-0.02em] text-primary">{value}</div>
    </div>
  );
}

/** Centered placeholder used when a chart has insufficient data. */
export function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-[140px] flex items-center justify-center text-muted text-body-sm">{label}</div>
  );
}
