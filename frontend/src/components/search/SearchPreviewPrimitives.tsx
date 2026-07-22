import { Trans } from '@lingui/react/macro';

// ---------------------------------------------------------------------------
// PreviewLoading: spinner / inline loading indicator
// ---------------------------------------------------------------------------

export function PreviewLoading() {
  return (
    <div className="flex items-center gap-2 text-body-sm text-muted">
      <span className="size-[6px] rounded-full bg-accent pulse-dot" />
      <Trans>Loading preview…</Trans>
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
        <div key={k} className="flex items-baseline gap-3 text-body-sm">
          <span className="text-secondary min-w-[80px] uppercase tracking-wider text-caption">{k}</span>
          <span className="text-primary truncate min-w-0">{v}</span>
        </div>
      ))}
    </div>
  );
}
