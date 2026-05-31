import type { ReactNode } from 'react';
import { Card } from '../../../../components/ui/Card';
import { Spinner } from '../../../../components/ui/Spinner';
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
  pendingLabel?: string;
  errorLabel?: string;
  testId?: string;
  children?: ReactNode;
}

/**
 * Shared chrome for every inline Tracey tool UI: a flat card with an optional icon + title
 * header, handling the pending and error states uniformly so each tool component only has to
 * render its ready content.
 */
export function ToolUIFrame({
  state,
  title,
  icon,
  accentBar,
  hoverColor,
  cornerAccessory,
  pendingLabel = 'Working…',
  errorLabel = 'Tracey couldn’t load this.',
  testId,
  children,
}: ToolUIFrameProps) {
  if (state === 'pending') {
    return (
      <Card elevation="flat" padding="sm" className="my-1 flex items-center gap-2" data-testid={testId}>
        <Spinner size={12} />
        <span className="text-body-sm text-muted">{pendingLabel}</span>
      </Card>
    );
  }
  if (state === 'error') {
    return (
      <Card elevation="flat" padding="sm" className="my-1" data-testid={testId}>
        <span className="text-body-sm text-danger">{errorLabel}</span>
      </Card>
    );
  }
  return (
    <Card
      elevation="flat"
      padding="md"
      accentBar={accentBar}
      hoverGlow={hoverColor}
      className="my-1"
      data-testid={testId}
    >
      {(icon || title) && (
        <div className="flex items-center gap-2">
          {icon && <span className="shrink-0 text-muted">{icon}</span>}
          {title && <span className="truncate text-h2 font-semibold text-primary">{title}</span>}
          {cornerAccessory && <span className="ml-auto shrink-0 pl-2">{cornerAccessory}</span>}
        </div>
      )}
      {children && <div className={icon || title ? 'mt-2.5' : undefined}>{children}</div>}
    </Card>
  );
}
