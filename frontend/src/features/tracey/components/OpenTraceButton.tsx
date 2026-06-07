import { ActivityIcon } from '../../../components/icons';
import { IconButton } from '../../../components/ui/Button';

/** Opens the captured trace(s) for a Tracey response. Navigation is owned by the caller. */
export function OpenTraceButton({ onClick }: { onClick: () => void }) {
  return (
    <IconButton
      size="sm"
      onClick={onClick}
      aria-label="View ingested trace"
      title="View ingested trace"
      data-testid="tracey-trace-link"
    >
      <ActivityIcon size={14} />
    </IconButton>
  );
}
