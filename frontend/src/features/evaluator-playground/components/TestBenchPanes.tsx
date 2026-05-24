import type { ReactNode } from 'react';

/** Titled pane (expected / actual response) with an optional badge slot. */
export function ResponsePane({ title, badge, children }: { title: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg border border-hairline bg-card-2 min-w-0 h-full overflow-hidden">
      <div className="flex items-center justify-between gap-2 min-h-[20px] shrink-0">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{title}</span>
        {badge}
      </div>
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">{children}</div>
    </div>
  );
}

/** Placeholder before a test result is picked. */
export function EmptyBench() {
  return (
    <div className="py-10 text-center text-[12.5px] text-muted">
      Pick a past test result to start testing this evaluator.
    </div>
  );
}

/** Inline error banner for a failed payload load. */
export function ErrorState({ message }: { message: string }) {
  return (
    <div className="p-3 rounded-md border border-[color-mix(in_srgb,var(--danger)_22%,transparent)] bg-[var(--danger-subtle)] text-[12px] text-danger">
      {message}
    </div>
  );
}
