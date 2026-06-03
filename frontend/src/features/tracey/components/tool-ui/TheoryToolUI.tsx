import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { type TheoryDto } from '../../../../api/models';
import { ToolUIFrame } from './ToolUIFrame';
import { toolUiState } from './tool-ui-state';
import { LiveTheoryCard } from './LiveTheoryCard';

function isTheory(value: unknown): value is TheoryDto {
  return typeof value === 'object' && value !== null
    && 'id' in value && 'rationale' in value && 'agentId' in value && 'suiteId' in value;
}

function isOutcome(value: unknown): value is { outcome: string; message: string } {
  return typeof value === 'object' && value !== null && 'outcome' in value;
}

function isCancelled(value: unknown): value is { cancelled: true } {
  return typeof value === 'object' && value !== null && 'cancelled' in value;
}

/**
 * Inline renderer for the `submit_optimization_theory` tool result. A successful submit hands off
 * to {@link LiveTheoryCard} (which streams the A/B status); a cancel or a duplicate/quota outcome
 * renders a quiet one-line note instead.
 */
export const TheoryToolUI: ToolCallMessagePartComponent = ({ result, status, isError }) => {
  const state = toolUiState(status, isError, result != null);
  if (state !== 'ready') {
    return <ToolUIFrame state={state} pendingLabel="Submitting theory…" testId="tracey-theory-card" />;
  }

  if (isCancelled(result)) {
    return (
      <ToolUIFrame state="ready" testId="tracey-theory-card">
        <span className="text-body-sm text-muted">Optimization cancelled.</span>
      </ToolUIFrame>
    );
  }

  if (isOutcome(result)) {
    return (
      <ToolUIFrame state="ready" testId="tracey-theory-card">
        <span className="text-body-sm text-secondary">{result.message}</span>
      </ToolUIFrame>
    );
  }

  if (!isTheory(result)) {
    return <ToolUIFrame state="error" errorLabel="Couldn’t submit the theory." testId="tracey-theory-card" />;
  }

  return <LiveTheoryCard initial={result} />;
};
