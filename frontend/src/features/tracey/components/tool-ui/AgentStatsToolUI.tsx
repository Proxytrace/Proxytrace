import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { useLingui } from '@lingui/react/macro';
import { ActivityIcon } from '../../../../components/icons';
import { fmtCost, fmtLatency, fmtTokens } from '../../../../lib/format';
import { ToolUIFrame } from './ToolUIFrame';
import { StatGrid, StatGridSkeleton } from './StatGrid';
import { CardOpenLink } from './CardOpenLink';
import { useArtifactResult } from '../../useArtifact';

/** Inline renderer for the `get_agent_stats` tool result (30-day window). */
export const AgentStatsToolUI: ToolCallMessagePartComponent = ({ args, result, status, isError }) => {
  const { t } = useLingui();
  const { state, data } = useArtifactResult('agent-stats', result, status, isError);
  if (state !== 'ready' || !data) {
    return (
      <ToolUIFrame
        state={state}
        pendingLabel={t`Loading agent stats…`}
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
      title={t`Agent stats · 30d`}
      icon={<ActivityIcon size={14} />}
      cornerAccessory={agentId ? <CardOpenLink to={`/agents?id=${agentId}`} /> : undefined}
      testId="tracey-agent-stats"
    >
      <StatGrid
        items={[
          { label: t`Traces`, value: fmtTokens(summary.totalTraces) },
          { label: t`Tokens in`, value: fmtTokens(summary.totalInputTokens) },
          { label: t`Tokens out`, value: fmtTokens(summary.totalOutputTokens) },
          { label: t`Cost`, value: fmtCost(summary.totalCostEur) },
          { label: t`Avg latency`, value: fmtLatency(summary.avgLatencyMs) },
          { label: t`Suites`, value: String(counts.suiteCount) },
          { label: t`Test cases`, value: String(counts.testCaseCount) },
          { label: t`Open proposals`, value: String(counts.openProposalCount) },
        ]}
      />
    </ToolUIFrame>
  );
};
