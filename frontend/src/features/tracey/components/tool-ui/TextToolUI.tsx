import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { MessageSparkleIcon } from '../../../../components/icons';
import type { TextArtifact as TextArtifactData } from '../../tracey-artifacts';
import { TextArtifact } from '../artifacts/TextArtifact';
import { ToolUIFrame } from './ToolUIFrame';
import { useArtifactResult } from '../../useArtifact';

/** Inline renderer for the `show_text` tool. */
export const TextToolUI: ToolCallMessagePartComponent = ({ result, status, isError }) => {
  const { state, data } = useArtifactResult<TextArtifactData>(result, status, isError);
  if (state !== 'ready' || !data) {
    return <ToolUIFrame state={state} pendingLabel="Writing…" testId="tracey-text" />;
  }
  return (
    <ToolUIFrame state="ready" title={data.title} icon={<MessageSparkleIcon size={14} />} testId="tracey-text">
      <TextArtifact artifact={data} />
    </ToolUIFrame>
  );
};
