import { ActivityIcon } from '../../../components/icons';

/** Opens the captured trace(s) for a Tracey response. Navigation is owned by the caller. */
export function OpenTraceButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="View ingested trace"
      title="View ingested trace"
      data-testid="tracey-trace-link"
      className="inline-flex size-6 items-center justify-center rounded-md text-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-primary)_60%,transparent)] cursor-pointer"
    >
      <ActivityIcon size={14} />
    </button>
  );
}
