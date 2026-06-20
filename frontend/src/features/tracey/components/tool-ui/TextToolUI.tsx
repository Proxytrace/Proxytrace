import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { useLingui } from '@lingui/react/macro';
import { MessageSparkleIcon } from '../../../../components/icons';
import { TextArtifact } from '../artifacts/TextArtifact';
import { ToolUIFrame } from './ToolUIFrame';
import { useArtifactResult } from '../../useArtifact';

/** Inline renderer for the `show_text` tool. */
export const TextToolUI: ToolCallMessagePartComponent = ({ result, status, isError }) => {
  const { t } = useLingui();
  // eslint-disable-next-line lingui/no-unlocalized-strings -- artifact kind token, not UI copy
  const { state, data } = useArtifactResult('text', result, status, isError);
  if (state !== 'ready' || !data) {
    return <ToolUIFrame state={state} pendingLabel={t`Writing…`} testId="tracey-text" />;
  }
  return (
    <ToolUIFrame state="ready" title={data.title} icon={<MessageSparkleIcon size={14} />} testId="tracey-text">
      <TextArtifact artifact={data} />
    </ToolUIFrame>
  );
};
