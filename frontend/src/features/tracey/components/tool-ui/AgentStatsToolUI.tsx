import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { ActivityIcon } from '../../../../components/icons';
import { fmtCost, fmtLatency, fmtTokens } from '../../../../lib/format';
import type { AgentEntityCountsDto, AgentTimeSummaryDto } from '../../../../api/models';
import { ToolUIFrame } from './ToolUIFrame';
import { StatGrid } from './StatGrid';
import { CardOpenLink } from './CardOpenLink';
import { toolUiState } from './tool-ui-state';

interface AgentStatsResult {
  summary: AgentTimeSummaryDto;
  counts: AgentEntityCountsDto;
}

/** Inline renderer for the `get_agent_stats` tool result (30-day window). */
export const AgentStatsToolUI: ToolCallMessagePartComponent = ({ args, result, status, isError }) => {
  const state = toolUiState(status, isError, result != null);
  if (state !== 'ready') {
    return <ToolUIFrame state={state} pendingLabel="Loading agent stats…" testId="tracey-agent-stats" />;
  }
  const { summary, counts } = result as AgentStatsResult;
  const agentId = (args as { agentId?: string }).agentId;
  return (
    <ToolUIFrame
      state="ready"
      title="Agent stats · 30d"
      icon={<ActivityIcon size={14} />}
      cornerAccessory={agentId ? <CardOpenLink to={`/agents?id=${agentId}`} /> : undefined}
      testId="tracey-agent-stats"
    >
      <StatGrid
        items={[
          { label: 'Traces', value: fmtTokens(summary.totalTraces) },
          { label: 'Tokens in', value: fmtTokens(summary.totalInputTokens) },
          { label: 'Tokens out', value: fmtTokens(summary.totalOutputTokens) },
          { label: 'Cost', value: fmtCost(summary.totalCostEur) },
          { label: 'Avg latency', value: fmtLatency(summary.avgLatencyMs) },
          { label: 'Suites', value: String(counts.suiteCount) },
          { label: 'Test cases', value: String(counts.testCaseCount) },
          { label: 'Open proposals', value: String(counts.openProposalCount) },
        ]}
      />
    </ToolUIFrame>
  );
};
