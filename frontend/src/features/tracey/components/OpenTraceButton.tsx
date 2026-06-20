import { useLingui } from '@lingui/react/macro';
import { ActivityIcon } from '../../../components/icons';
import { IconButton } from '../../../components/ui/Button';

/** Opens the captured trace(s) for a Tracey response. Navigation is owned by the caller. */
export function OpenTraceButton({ onClick }: { onClick: () => void }) {
  const { t } = useLingui();
  return (
    <IconButton
      size="sm"
      onClick={onClick}
      aria-label={t`View ingested trace`}
      title={t`View ingested trace`}
      data-testid="tracey-trace-link"
    >
      <ActivityIcon size={14} />
    </IconButton>
  );
}
