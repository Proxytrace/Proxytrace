import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { useArtifactResult } from '../../useArtifact';
import { ToolUIFrame } from './ToolUIFrame';
import { LiveRunCard } from './LiveRunCard';

function isCancelled(value: unknown): value is { cancelled: true } {
  return typeof value === 'object' && value !== null && 'cancelled' in value;
}

/**
 * Inline renderer for the `start_test_run` tool result. A confirmed start hands off to
 * {@link LiveRunCard} (which streams progress); a declined confirmation renders a quiet note.
 */
export const StartTestRunToolUI: ToolCallMessagePartComponent = ({ result, status, isError }) => {
  const { state, data: group } = useArtifactResult('test-run-group', result, status, isError);

  if (isCancelled(result)) {
    return (
      <ToolUIFrame state="ready" testId="tracey-run-progress-card">
        <span className="text-body-sm text-muted">Test run cancelled.</span>
      </ToolUIFrame>
    );
  }

  if (state !== 'ready' || !group) {
    return <ToolUIFrame state={state} pendingLabel="Starting test run…" testId="tracey-run-progress-card" />;
  }
  return <LiveRunCard initial={group} />;
};
