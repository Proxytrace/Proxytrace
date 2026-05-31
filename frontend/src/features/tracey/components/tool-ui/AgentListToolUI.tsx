import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { CpuIcon } from '../../../../components/icons';
import { agentColor } from '../../../../lib/colors';
import { fmtRelative } from '../../../../lib/format';
import type { AgentDto } from '../../../../api/models';
import { ListCard, LIST_CARD_MAX } from './ListCard';
import { ListCardRow } from './ListCardRow';
import { toolUiState } from './tool-ui-state';

/** Inline renderer for the `list_agents` tool result. */
export const AgentListToolUI: ToolCallMessagePartComponent = ({ result, status, isError }) => {
  const state = toolUiState(status, isError, result != null);
  const agents = (result as AgentDto[] | undefined) ?? [];
  return (
    <ListCard
      state={state}
      icon={<CpuIcon size={14} />}
      title="Agents"
      count={agents.length}
      shown={Math.min(agents.length, LIST_CARD_MAX)}
      viewAllTo="/agents"
      pendingLabel="Loading agents…"
      emptyLabel="No agents in this project yet."
      testId="tracey-agent-list"
    >
      {agents.slice(0, LIST_CARD_MAX).map((agent) => (
        <ListCardRow
          key={agent.id}
          to={`/agents?id=${agent.id}`}
          color={agentColor(agent.id)}
          title={agent.name}
          subtitle={`${agent.endpointName} · ${agent.tools.length} tools`}
          right={
            <span className="font-mono text-body-sm tabular-nums text-muted">
              {agent.lastUsedAt ? fmtRelative(agent.lastUsedAt) : 'never'}
            </span>
          }
        />
      ))}
    </ListCard>
  );
};
