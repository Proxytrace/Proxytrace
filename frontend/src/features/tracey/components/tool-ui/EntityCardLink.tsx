import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ToolUIFrame } from './ToolUIFrame';
import type { ToolUIState } from './tool-ui-state';

interface EntityCardLinkProps {
  state: ToolUIState;
  /** In-app route the card links to. */
  to: string;
  title: string;
  icon: ReactNode;
  /** Per-entity color for the accent bar + hover glow. */
  color: string;
  testId: string;
  pendingLabel: string;
  children: ReactNode;
}

/**
 * A read-only entity result (agent, run, proposal, …) rendered inline as a card that links
 * into the matching app route. The whole card is a real anchor, so it is keyboard-focusable
 * and supports open-in-new-tab.
 */
export function EntityCardLink({ state, to, title, icon, color, testId, pendingLabel, children }: EntityCardLinkProps) {
  if (state !== 'ready') {
    return <ToolUIFrame state={state} pendingLabel={pendingLabel} testId={testId} />;
  }
  return (
    <Link
      to={to}
      data-testid={testId}
      className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-primary)_60%,transparent)]"
    >
      <ToolUIFrame state="ready" title={title} icon={icon} accentBar={color} hoverColor={color}>
        {children}
      </ToolUIFrame>
    </Link>
  );
}
