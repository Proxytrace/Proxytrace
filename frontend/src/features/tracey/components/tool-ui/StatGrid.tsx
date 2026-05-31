export interface StatItem {
  label: string;
  value: string;
}

/** A compact, responsive grid of labelled figures used by the stats tool cards. */
export function StatGrid({ items }: { items: StatItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-0.5">
          <span className="text-caption uppercase tracking-[0.06em] text-muted">{item.label}</span>
          <span className="font-mono text-h1 font-semibold tabular-nums text-primary">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
