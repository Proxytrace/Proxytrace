import type { ReactNode } from 'react';
import { useLingui } from '@lingui/react/macro';
import { AlertTriangleIcon } from '../../../../components/icons';
import { Card } from '../../../../components/ui/Card';
import { Spinner } from '../../../../components/ui/Spinner';
import { cn } from '../../../../lib/cn';
import type { ToolUIState } from './tool-ui-state';

interface ToolUIFrameProps {
  state: ToolUIState;
  title?: ReactNode;
  icon?: ReactNode;
  /** Runtime color for the top accent bar (per-entity). */
  accentBar?: string;
  /** Runtime color enabling the interactive hover glow (entity cards). */
  hoverColor?: string;
  /** Optional element pinned to the card's top-right corner (e.g. a navigate affordance). */
  cornerAccessory?: ReactNode;
  /**
   * The card's contents are still streaming/updating (live run progress, an active wait):
   * draws the animated `streaming-border` ring around the ready card per DESIGN.md §8.
   */
  live?: boolean;
  pendingLabel?: string;
  /**
   * Shaped placeholder rendered while pending, reserving the ready layout's height to avoid a
   * jump when the result arrives. Falls back to a spinner + {@link pendingLabel} when omitted.
   */
  pendingSkeleton?: ReactNode;
  errorLabel?: string;
  testId?: string;
  children?: ReactNode;
}

/**
 * Shared chrome for every inline Tracey tool UI: a flat card with an optional icon + title
 * header, handling the pending and error states uniformly so each tool component only has to
 * render its ready content. Pending cards carry the animated streaming ring; ready cards enter
 * with the standard fade-up (both respect `prefers-reduced-motion`).
 */
export function ToolUIFrame({
  state,
  title,
  icon,
  accentBar,
  hoverColor,
  cornerAccessory,
  live,
  pendingLabel,
  pendingSkeleton,
  errorLabel,
  testId,
  children,
}: ToolUIFrameProps) {
  const { t } = useLingui();
  const resolvedPendingLabel = pendingLabel ?? t`Working…`;
  const resolvedErrorLabel = errorLabel ?? t`Tracey couldn’t load this.`;
  if (state === 'pending') {
    if (pendingSkeleton) {
      return (
        <Card elevation="flat" padding="md" className="streaming-border my-1" data-testid={testId} aria-busy={true}>
          {pendingSkeleton}
        </Card>
      );
    }
    return (
      <Card
        elevation="flat"
        padding="sm"
        className="streaming-border my-1 flex items-center gap-2"
        data-testid={testId}
        aria-busy={true}
      >
        <Spinner size={12} />
        <span className="text-body-sm text-muted">{resolvedPendingLabel}</span>
      </Card>
    );
  }
  if (state === 'error') {
    return (
      <Card elevation="flat" padding="sm" className="fade-up my-1 flex items-center gap-2" data-testid={testId}>
        <span className="shrink-0 text-danger"><AlertTriangleIcon size={13} /></span>
        <span className="text-body-sm text-danger">{resolvedErrorLabel}</span>
      </Card>
    );
  }
  return (
    <Card
      elevation="flat"
      padding="md"
      accentBar={accentBar}
      hoverGlow={hoverColor}
      className={cn('fade-up my-1', live && 'streaming-border')}
      data-testid={testId}
    >
      {(icon || title || cornerAccessory) && (
        <div className="flex items-center gap-2">
          {icon && <span className="shrink-0 text-muted">{icon}</span>}
          {title && <span className="min-w-0 truncate text-h2 font-semibold text-primary">{title}</span>}
          {cornerAccessory && <span className="ml-auto shrink-0 pl-2">{cornerAccessory}</span>}
        </div>
      )}
      {children && <div className={icon || title || cornerAccessory ? 'mt-2.5' : undefined}>{children}</div>}
    </Card>
  );
}
