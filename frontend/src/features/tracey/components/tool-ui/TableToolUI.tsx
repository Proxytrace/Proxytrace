import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { TableIcon } from '../../../../components/icons';
import { TableArtifact } from '../artifacts/TableArtifact';
import { ToolUIFrame } from './ToolUIFrame';
import { useArtifactResult } from '../../useArtifact';

/** Inline renderer for the `show_table` tool. */
export const TableToolUI: ToolCallMessagePartComponent = ({ result, status, isError }) => {
  const { state, data } = useArtifactResult('table', result, status, isError);
  if (state !== 'ready' || !data) {
    return <ToolUIFrame state={state} pendingLabel="Building table…" testId="tracey-table" />;
  }
  return (
    <ToolUIFrame state="ready" title={data.title} icon={<TableIcon size={14} />} testId="tracey-table">
      <TableArtifact artifact={data} />
    </ToolUIFrame>
  );
};
