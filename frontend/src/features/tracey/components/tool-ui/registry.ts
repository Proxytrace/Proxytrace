import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { ChartToolUI } from './ChartToolUI';
import { TableToolUI } from './TableToolUI';
import { TextToolUI } from './TextToolUI';
import { AgentCardToolUI } from './AgentCardToolUI';
import { RunCardToolUI } from './RunCardToolUI';
import { ProposalCardToolUI } from './ProposalCardToolUI';
import { ProviderCardToolUI } from './ProviderCardToolUI';
import { TraceCardToolUI } from './TraceCardToolUI';
import { ActionPromptToolUI } from './ActionPromptToolUI';
import { FormToolUI } from './FormToolUI';

/**
 * Maps a Tracey tool name to the React component that renders its result inline in the chat
 * thread (assistant-ui `MessagePrimitive.Parts` `tools.by_name`). Tools absent here fall back
 * to the diagnostic {@link ToolCallCard} (e.g. `navigate`, `list_*`, `get_dashboard_stats`).
 */
export const TRACEY_TOOL_UI: Record<string, ToolCallMessagePartComponent> = {
  show_chart: ChartToolUI,
  show_table: TableToolUI,
  show_text: TextToolUI,
  get_agent: AgentCardToolUI,
  get_run: RunCardToolUI,
  get_proposal: ProposalCardToolUI,
  get_provider: ProviderCardToolUI,
  get_trace: TraceCardToolUI,
  present_choices: ActionPromptToolUI,
  show_form: FormToolUI,
};
