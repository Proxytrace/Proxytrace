import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../../../components/ui/Card';
import { Badge } from '../../../../components/ui/Badge';
import { ArrowUpRightIcon } from '../../../../components/icons';
import { ToolUIFrame } from './ToolUIFrame';
import type { ToolUIState } from './tool-ui-state';

/** Max rows a list card renders inline before deferring the rest to its "View all" route. */
export const LIST_CARD_MAX = 6;

interface ListCardProps {
  state: ToolUIState;
  icon: ReactNode;
  /** Plural noun for the collection, e.g. "Agents". */
  title: string;
  count: number;
  /** Route the "View all" header link opens. */
  viewAllTo: string;
  pendingLabel: string;
  emptyLabel: string;
  testId: string;
  /** Rendered rows (already capped by the caller); the footer notes any overflow. */
  children: ReactNode;
  /** How many rows `children` actually contains, to drive the "+N more" footer. */
  shown: number;
}

/**
 * Shared chrome for a list tool result (agents, runs, proposals, …): a titled card with a count
 * badge and a "View all" link, a hairline-divided row list, and an overflow footer. Pending and
 * error states defer to {@link ToolUIFrame} so every tool UI behaves alike.
 */
export function ListCard({
  state,
  icon,
  title,
  count,
  viewAllTo,
  pendingLabel,
  emptyLabel,
  testId,
  children,
  shown,
}: ListCardProps) {
  if (state !== 'ready') {
    return <ToolUIFrame state={state} pendingLabel={pendingLabel} testId={testId} />;
  }
  const hidden = count - shown;
  return (
    <Card elevation="flat" padding="none" className="my-1" data-testid={testId}>
      <div className="flex items-center gap-2 border-b border-hairline px-3 py-2.5">
        <span className="shrink-0 text-muted">{icon}</span>
        <span className="text-h2 font-semibold text-primary">{title}</span>
        <Badge label={String(count)} variant="neutral" size="sm" />
        {count > 0 && (
          <Link
            to={viewAllTo}
            className="ml-auto inline-flex items-center gap-1 rounded-sm text-body-sm text-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-primary)_60%,transparent)]"
          >
            View all
            <ArrowUpRightIcon size={13} />
          </Link>
        )}
      </div>

      {count === 0 ? (
        <div className="px-3 py-4 text-body-sm text-muted">{emptyLabel}</div>
      ) : (
        <div className="divide-y divide-border-subtle">{children}</div>
      )}

      {hidden > 0 && (
        <Link
          to={viewAllTo}
          className="block border-t border-hairline px-3 py-2 text-center text-body-sm text-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-primary)_60%,transparent)]"
        >
          +{hidden} more
        </Link>
      )}
    </Card>
  );
}
