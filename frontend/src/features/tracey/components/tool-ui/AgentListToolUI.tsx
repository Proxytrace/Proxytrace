import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { CpuIcon } from '../../../../components/icons';
import { agentColor, modelColor } from '../../../../lib/colors';
import { fmtRelative } from '../../../../lib/format';
import { ListCard, LIST_CARD_MAX } from './ListCard';
import { ListCardRow } from './ListCardRow';
import { useArtifactResult } from '../../useArtifact';

/** Inline renderer for the `list_agents` tool result. */
export const AgentListToolUI: ToolCallMessagePartComponent = ({ result, status, isError }) => {
  const { state, data } = useArtifactResult('agent-list', result, status, isError);
  const agents = data ?? [];
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
          subtitle={
            <>
              <span className="font-mono" style={{ color: modelColor(agent.endpointName) }}>
                {agent.endpointName}
              </span>
              {' · '}
              {agent.toolCount} {agent.toolCount === 1 ? 'tool' : 'tools'}
            </>
          }
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
