import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import type { MessageDescriptor } from '@lingui/core';
import { Trans, useLingui } from '@lingui/react/macro';
import { type TheoryDto } from '../../../../api/models';
import { useArtifactResult } from '../../useArtifact';
import { ToolUIFrame } from './ToolUIFrame';
import { LiveTheoryCard } from './LiveTheoryCard';

function isTheory(value: unknown): value is TheoryDto {
  return typeof value === 'object' && value !== null
    && 'id' in value && 'rationale' in value && 'agentId' in value && 'suiteId' in value;
}

function isOutcome(value: unknown): value is { outcome: string; message: string | MessageDescriptor } {
  return typeof value === 'object' && value !== null && 'outcome' in value;
}

function isCancelled(value: unknown): value is { cancelled: true } {
  return typeof value === 'object' && value !== null && 'cancelled' in value;
}

/**
 * Inline renderer for the `submit_optimization_theory` tool result. A successful submit stores the
 * full theory as an artifact (the model only sees a compact digest); this card resolves it and
 * hands off to {@link LiveTheoryCard} (which streams the A/B status). A cancel or a
 * duplicate/quota outcome renders a quiet one-line note instead.
 */
export const TheoryToolUI: ToolCallMessagePartComponent = ({ result, status, isError }) => {
  const { t, i18n } = useLingui();
  // eslint-disable-next-line lingui/no-unlocalized-strings -- artifact kind token, not UI copy
  const { state, data } = useArtifactResult('theory', result, status, isError);

  if (isCancelled(result)) {
    return (
      <ToolUIFrame state="ready" testId="tracey-theory-card">
        <span className="text-body-sm text-muted"><Trans>Optimization cancelled.</Trans></span>
      </ToolUIFrame>
    );
  }

  if (isOutcome(result)) {
    const message = typeof result.message === 'string' ? result.message : i18n._(result.message);
    return (
      <ToolUIFrame state="ready" testId="tracey-theory-card">
        <span className="text-body-sm text-secondary">{message}</span>
      </ToolUIFrame>
    );
  }

  if (state !== 'ready') {
    return <ToolUIFrame state={state} pendingLabel={t`Submitting theory…`} testId="tracey-theory-card" />;
  }

  if (!isTheory(data)) {
    return <ToolUIFrame state="error" errorLabel={t`Couldn’t submit the theory.`} testId="tracey-theory-card" />;
  }

  return <LiveTheoryCard initial={data} />;
};
