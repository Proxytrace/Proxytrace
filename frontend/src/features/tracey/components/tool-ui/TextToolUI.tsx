import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { MessageSparkleIcon } from '../../../../components/icons';
import type { TextArtifact as TextArtifactData } from '../../tracey-artifacts';
import { TextArtifact } from '../artifacts/TextArtifact';
import { ToolUIFrame } from './ToolUIFrame';
import { toolUiState } from './tool-ui-state';

/** Inline renderer for the `show_text` tool. */
export const TextToolUI: ToolCallMessagePartComponent = ({ result, status, isError }) => {
  const state = toolUiState(status, isError, result != null);
  if (state !== 'ready') {
    return <ToolUIFrame state={state} pendingLabel="Writing…" testId="tracey-text" />;
  }
  const data = result as TextArtifactData;
  return (
    <ToolUIFrame state="ready" title={data.title} icon={<MessageSparkleIcon size={14} />} testId="tracey-text">
      <TextArtifact artifact={data} />
    </ToolUIFrame>
  );
};
