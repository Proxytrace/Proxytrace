import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { ChartToolUI } from './ChartToolUI';
import { TableToolUI } from './TableToolUI';
import { TextToolUI } from './TextToolUI';
import { AgentCardToolUI } from './AgentCardToolUI';
import { SuiteCardToolUI } from './SuiteCardToolUI';
import { RunCardToolUI } from './RunCardToolUI';
import { ProposalCardToolUI } from './ProposalCardToolUI';
import { ProviderCardToolUI } from './ProviderCardToolUI';
import { TraceCardToolUI } from './TraceCardToolUI';
import { AskQuestionsToolUI } from './AskQuestionsToolUI';
import { AgentListToolUI } from './AgentListToolUI';
import { SuiteListToolUI } from './SuiteListToolUI';
import { RunListToolUI } from './RunListToolUI';
import { ProposalListToolUI } from './ProposalListToolUI';
import { DashboardStatsToolUI } from './DashboardStatsToolUI';
import { AgentStatsToolUI } from './AgentStatsToolUI';

/**
 * Maps a Tracey tool name to the React component that renders its result inline in the chat
 * thread (assistant-ui `MessagePrimitive.Parts` `tools.by_name`). Tools absent here fall back
 * to the diagnostic {@link ToolCallCard} (e.g. `navigate`).
 */
export const TRACEY_TOOL_UI: Record<string, ToolCallMessagePartComponent> = {
  show_chart: ChartToolUI,
  show_table: TableToolUI,
  show_text: TextToolUI,
  get_agent: AgentCardToolUI,
  get_suite: SuiteCardToolUI,
  get_run: RunCardToolUI,
  get_proposal: ProposalCardToolUI,
  get_provider: ProviderCardToolUI,
  get_trace: TraceCardToolUI,
  ask_questions: AskQuestionsToolUI,
  list_agents: AgentListToolUI,
  list_suites: SuiteListToolUI,
  list_runs: RunListToolUI,
  list_proposals: ProposalListToolUI,
  get_dashboard_stats: DashboardStatsToolUI,
  get_agent_stats: AgentStatsToolUI,
};
