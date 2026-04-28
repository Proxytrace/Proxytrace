import { Component, signal, computed } from '@angular/core';

interface AgentTool {
  name: string; description: string; category: 'read' | 'write' | 'system';
}
interface AgentVersion {
  version: string; label: string; date: string; change: string; active: boolean;
}
interface Agent {
  id: string; name: string; description: string; model: string;
  runs: number; passRate: number | null; lastRun: string;
  tags: string[]; tools: AgentTool[];
  systemPrompt: string;
  versions: AgentVersion[];
  avgLatency: string; avgCost: number;
  totalTokensIn: number; totalTokensOut: number;
}

const AGENT_COLORS: Record<string, string> = {
  'Customer Support': '#8b5cf6', 'Code Helper': '#06b6d4',
  'Ticket Triage': '#10b981', 'Classifier': '#f59e0b',
};
const MODEL_COLORS: Record<string, string> = {
  'gpt-4o': '#8b5cf6', 'gpt-4o-mini': '#06b6d4',
  'gpt-3.5-turbo': '#f59e0b', 'claude-3.5-sonnet': '#10b981',
};

const AGENTS_DATA: Agent[] = [
  {
    id: 'agent-cs', name: 'Customer Support', description: 'Handles order inquiries, refunds, billing questions and escalations via tool calls.',
    model: 'gpt-4o', runs: 11, passRate: 76, lastRun: '2h ago',
    tags: ['production', 'tool-use', 'escalation'],
    avgLatency: '2.1s', avgCost: 0.34, totalTokensIn: 145000, totalTokensOut: 68000,
    tools: [
      { name: 'lookup_order', description: 'Fetch order details by ID or email.', category: 'read' },
      { name: 'issue_refund', description: 'Initiate a full or partial refund for an order.', category: 'write' },
      { name: 'escalate_ticket', description: 'Escalate a case to tier-2 support with priority flag.', category: 'write' },
      { name: 'get_shipping_status', description: 'Query carrier API for live tracking status.', category: 'read' },
      { name: 'update_order_note', description: 'Append an internal note to the order record.', category: 'write' },
    ],
    systemPrompt: `You are a customer support agent for Trsr. Your goal is to resolve customer issues efficiently and empathetically.

Always follow this workflow:
1. Use lookup_order to fetch the customer's order before making any changes.
2. Acknowledge the customer's frustration before proposing a solution.
3. For refunds above $200, escalate via escalate_ticket with priority=P1.
4. Never promise delivery dates — use get_shipping_status and report facts.

Tone: professional, warm, concise. Avoid corporate jargon.`,
    versions: [
      { version: 'v1.3', label: 'current', date: 'Apr 22', change: 'Added escalate_ticket tool, improved refund logic', active: true },
      { version: 'v1.2', label: '', date: 'Apr 18', change: 'Rewrote empathy handling instructions', active: false },
      { version: 'v1.1', label: '', date: 'Apr 12', change: 'Added get_shipping_status tool', active: false },
      { version: 'v1.0', label: 'initial', date: 'Apr 8', change: 'Initial version', active: false },
    ],
  },
  {
    id: 'agent-code', name: 'Code Helper', description: 'Localises bugs and proposes fixes by searching and reading source files before acting.',
    model: 'gpt-4o-mini', runs: 5, passRate: 73, lastRun: '4h ago',
    tags: ['dev-tools', 'tool-use', 'csharp'],
    avgLatency: '3.4s', avgCost: 0.08, totalTokensIn: 88000, totalTokensOut: 42000,
    tools: [
      { name: 'search_code', description: 'Full-text search across the repository.', category: 'read' },
      { name: 'read_file', description: 'Read the contents of a specific file.', category: 'read' },
      { name: 'propose_fix', description: 'Return a structured diff for a code change.', category: 'system' },
    ],
    systemPrompt: `You are a code debugging assistant. You MUST follow the tool call sequence exactly:
1. ALWAYS call search_code first to find relevant files.
2. ALWAYS call read_file to verify context before proposing a fix.
3. Only then call propose_fix with a minimal, targeted change.

Never skip step 1 or 2. Skipping these steps is evaluated as a failure.`,
    versions: [
      { version: 'v1.1', label: 'current', date: 'Apr 19', change: 'Enforced strict tool-call ordering in prompt', active: true },
      { version: 'v1.0', label: 'initial', date: 'Apr 15', change: 'Initial version', active: false },
    ],
  },
  {
    id: 'agent-triage', name: 'Ticket Triage', description: 'Assigns P0–P3 priority and routes tickets to the correct team.',
    model: 'claude-3.5-sonnet', runs: 4, passRate: 78, lastRun: '6h ago',
    tags: ['production', 'classification', 'routing'],
    avgLatency: '1.8s', avgCost: 0.51, totalTokensIn: 72000, totalTokensOut: 28000,
    tools: [
      { name: 'get_account_tier', description: 'Fetch account tier (enterprise / pro / free).', category: 'read' },
      { name: 'route_ticket', description: 'Assign ticket to team with priority label.', category: 'write' },
    ],
    systemPrompt: `You are a ticket triage agent. Assign every incoming ticket a priority (P0–P3) and route it to the correct team.

Priority rules:
- P0: Data loss, security incident, full service outage
- P1: Major feature broken for enterprise customer
- P2: Bug with workaround, billing issue
- P3: Feature request, general question

Always call get_account_tier before routing — enterprise tickets are auto-elevated one level.`,
    versions: [
      { version: 'v1.2', label: 'current', date: 'Apr 20', change: 'Added enterprise auto-elevation rule', active: true },
      { version: 'v1.1', label: '', date: 'Apr 17', change: 'Defined explicit P0–P3 rules', active: false },
      { version: 'v1.0', label: 'initial', date: 'Apr 14', change: 'Initial version', active: false },
    ],
  },
  {
    id: 'agent-cls', name: 'Classifier', description: 'Classifies support tickets into categories with a confidence score.',
    model: 'gpt-3.5-turbo', runs: 1, passRate: 45, lastRun: '3d ago',
    tags: ['json-output', 'classification'],
    avgLatency: '0.9s', avgCost: 0.01, totalTokensIn: 22000, totalTokensOut: 8000,
    tools: [],
    systemPrompt: `You are a ticket classification model. Given a ticket body, output a JSON object:
{
  "category": "billing" | "bug" | "feature" | "other",
  "confidence": 0.0–1.0,
  "reason": "one-sentence explanation"
}

Output ONLY the JSON. No prose. No markdown.`,
    versions: [
      { version: 'v1.0', label: 'current', date: 'Apr 14', change: 'Initial version', active: true },
    ],
  },
];

@Component({
  selector: 'app-agents',
  templateUrl: './agents.html',
  styles: `:host { display: block; flex: 1; min-height: 0; overflow-y: auto; }`,
})
export class Agents {
  readonly agentColors = AGENT_COLORS;
  readonly modelColors = MODEL_COLORS;

  readonly selectedAgentId = signal(AGENTS_DATA[0].id);
  readonly activeTab = signal<'prompt' | 'tools' | 'versions'>('prompt');
  readonly tabs: Array<'prompt' | 'tools' | 'versions'> = ['prompt', 'tools', 'versions'];

  readonly selectedAgent = computed(() => AGENTS_DATA.find(a => a.id === this.selectedAgentId()) ?? AGENTS_DATA[0]);

  readonly agents = AGENTS_DATA;

  agentColor(name: string) { return AGENT_COLORS[name] ?? '#8b5cf6'; }
  modelColor(model: string) { return MODEL_COLORS[model] ?? '#888'; }
  passColor(rate: number | null) {
    if (rate === null) return 'var(--text-muted)';
    return rate >= 75 ? 'var(--success)' : rate >= 55 ? 'var(--warn)' : 'var(--danger)';
  }
  toolCategoryColor(cat: 'read' | 'write' | 'system') {
    return cat === 'read' ? 'var(--teal)' : cat === 'write' ? 'var(--warn)' : 'var(--accent-primary)';
  }
  toolCategoryBg(cat: 'read' | 'write' | 'system') {
    return cat === 'read' ? 'rgba(6,182,212,0.12)' : cat === 'write' ? 'rgba(245,158,11,0.12)' : 'rgba(139,92,246,0.12)';
  }
}
