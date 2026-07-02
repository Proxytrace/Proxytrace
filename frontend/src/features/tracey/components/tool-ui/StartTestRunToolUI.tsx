import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { Trans, useLingui } from '@lingui/react/macro';
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
  const { t } = useLingui();
  // eslint-disable-next-line lingui/no-unlocalized-strings -- artifact kind token, not UI copy
  const { state, data: group } = useArtifactResult('test-run-group', result, status, isError);

  if (isCancelled(result)) {
    return (
      <ToolUIFrame state="ready" testId="tracey-run-progress-card">
        <span className="text-body-sm text-muted"><Trans>Test run cancelled.</Trans></span>
      </ToolUIFrame>
    );
  }

  if (state !== 'ready' || !group) {
    // The error placeholder gets its own testid: a failed start_test_run call the model retries
    // leaves this card in the thread next to the retry's live card, and sharing
    // `tracey-run-progress-card` made the two indistinguishable (Playwright strict mode, #273).
    return (
      <ToolUIFrame
        state={state}
        pendingLabel={t`Starting test run…`}
        testId={state === 'error' ? 'tracey-run-progress-error' : 'tracey-run-progress-card'}
      />
    );
  }
  return <LiveRunCard initial={group} />;
};
