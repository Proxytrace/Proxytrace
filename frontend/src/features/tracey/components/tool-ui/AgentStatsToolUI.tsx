import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { ActivityIcon } from '../../../../components/icons';
import { fmtCost, fmtLatency, fmtTokens } from '../../../../lib/format';
import { ToolUIFrame } from './ToolUIFrame';
import { StatGrid, StatGridSkeleton } from './StatGrid';
import { CardOpenLink } from './CardOpenLink';
import { useArtifactResult } from '../../useArtifact';

/** Inline renderer for the `get_agent_stats` tool result (30-day window). */
export const AgentStatsToolUI: ToolCallMessagePartComponent = ({ args, result, status, isError }) => {
  const { state, data } = useArtifactResult('agent-stats', result, status, isError);
  if (state !== 'ready' || !data) {
    return (
      <ToolUIFrame
        state={state}
        pendingLabel="Loading agent stats…"
        pendingSkeleton={<StatGridSkeleton count={8} />}
        testId="tracey-agent-stats"
      />
    );
  }
  const { summary, counts } = data;
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
