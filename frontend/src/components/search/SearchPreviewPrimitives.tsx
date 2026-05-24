// ---------------------------------------------------------------------------
// PreviewLoading: spinner / inline loading indicator
// ---------------------------------------------------------------------------

export function PreviewLoading() {
  return (
    <div className="flex items-center gap-2 text-[11.5px] text-white/40">
      <span className="size-[6px] rounded-full bg-accent pulse-dot" />
      Loading preview…
    </div>
  );
}

// ---------------------------------------------------------------------------
// MetaGrid: key/value rows for preview metadata
// ---------------------------------------------------------------------------

interface MetaGridProps {
  entries: [string, string][];
}

export function MetaGrid({ entries }: MetaGridProps) {
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-baseline gap-3 text-[11.5px]">
          <span className="text-white/40 min-w-[80px] uppercase tracking-wider text-[10px]">{k}</span>
          <span className="text-white/80 truncate">{v}</span>
        </div>
      ))}
    </div>
  );
}
