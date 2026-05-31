import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { ActivityIcon } from '../../../../components/icons';
import type { ChartArtifact as ChartArtifactData } from '../../tracey-artifacts';
import { ChartArtifact } from '../artifacts/ChartArtifact';
import { ToolUIFrame } from './ToolUIFrame';
import { toolUiState } from './tool-ui-state';

/** Inline renderer for the `show_chart` tool. */
export const ChartToolUI: ToolCallMessagePartComponent = ({ result, status, isError }) => {
  const state = toolUiState(status, isError, result != null);
  if (state !== 'ready') {
    return <ToolUIFrame state={state} pendingLabel="Building chart…" testId="tracey-chart" />;
  }
  const data = result as ChartArtifactData;
  return (
    <ToolUIFrame state="ready" title={data.title} icon={<ActivityIcon size={14} />} testId="tracey-chart">
      <ChartArtifact artifact={data} />
    </ToolUIFrame>
  );
};
