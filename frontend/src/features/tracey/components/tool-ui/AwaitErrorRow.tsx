import { Trans, useLingui } from '@lingui/react/macro';
import { Badge } from '../../../../components/ui/Badge';
import type { AwaitError } from '../../tools/await';

/**
 * A settled await-card row for a handle whose state could not be read (bad id, persistent network
 * failure). The action itself may still be running — hence "Failed to check", not "failed".
 * `delayIndex` staggers the entrance alongside the result rows.
 */
export function AwaitErrorRow({ item, delayIndex }: { item: AwaitError; delayIndex: number }) {
  const { t } = useLingui();
  return (
    <div
      className="fade-up flex items-center gap-2"
      style={{ animationDelay: `${delayIndex * 60}ms` }}
      data-testid={`tracey-await-row-${item.id}`}
    >
      <span className="min-w-0 flex-1 truncate text-body-sm text-secondary">
        {item.kind === 'test-run' ? <Trans>Test run</Trans> : <Trans>Theory</Trans>}{' '}
        <span className="font-mono text-muted">{item.id}</span>
      </span>
      <Badge label={t`Failed to check`} variant="danger" size="sm" title={item.error} />
    </div>
  );
}
