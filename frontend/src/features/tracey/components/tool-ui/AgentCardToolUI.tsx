import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { CpuIcon } from '../../../../components/icons';
import { Pill } from '../../../../components/ui/Pill';
import { Badge } from '../../../../components/ui/Badge';
import { agentColor, modelColor } from '../../../../lib/colors';
import { fmtRelative } from '../../../../lib/format';
import type { AgentDto } from '../../../../api/models';
import { EntityCardLink } from './EntityCardLink';
import { toolUiState } from './tool-ui-state';

/** Inline renderer for the `get_agent` tool result. */
export const AgentCardToolUI: ToolCallMessagePartComponent = ({ result, status, isError }) => {
  const state = toolUiState(status, isError, result != null);
  const agent = result as AgentDto | undefined;
  return (
    <EntityCardLink
      state={state}
      to={agent ? `/agents?id=${agent.id}` : '/agents'}
      title={agent?.name ?? ''}
      icon={<CpuIcon size={14} />}
      color={agentColor(agent?.id ?? '')}
      testId="tracey-agent-card"
      pendingLabel="Loading agent…"
    >
      {agent && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill label={agent.endpointName} color={modelColor(agent.endpointName)} size="sm" />
            {agent.isSystemAgent && <Badge label="System" variant="accent" size="sm" />}
          </div>
          <div className="text-body-sm text-muted">
            {agent.tools.length} tools · {agent.lastUsedAt ? `used ${fmtRelative(agent.lastUsedAt)}` : 'never used'}
          </div>
        </div>
      )}
    </EntityCardLink>
  );
};
