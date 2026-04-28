import { Component, signal, computed } from '@angular/core';

interface CaseResult {
  id: string; name: string; pass: boolean; score: number;
  evaluator: string; latency: number; note: string;
}
interface ModelResult {
  model: string; passed: number; failed: number; passRate: number;
  duration: string; costUsd: number; tokensIn: number; tokensOut: number;
}
interface Run {
  id: string; suite: string; agent: string;
  multiModel?: boolean;
  model?: string; status: string;
  passRate?: number; prevPassRate?: number | null;
  cases: number; passed?: number; failed?: number;
  duration?: string; startedAt: string; timestamp: string;
  evaluators: string[];
  caseResults?: CaseResult[];
  modelResults?: ModelResult[];
}

const AGENT_COLORS: Record<string, string> = {
  'Customer Support': '#8b5cf6', 'Code Helper': '#06b6d4',
  'Ticket Triage': '#10b981', 'Classifier': '#f59e0b',
};
const MODEL_COLORS: Record<string, string> = {
  'gpt-4o': '#8b5cf6', 'gpt-4o-mini': '#06b6d4',
  'gpt-3.5-turbo': '#f59e0b', 'claude-3.5-sonnet': '#10b981',
};
const EVALUATOR_META: Record<string, { label: string; color: string }> = {
  tool_call_match: { label: 'Tool match', color: '#10b981' },
  semantic:        { label: 'Semantic',   color: '#8b5cf6' },
  exact:           { label: 'Exact',      color: '#06b6d4' },
  llm_judge:       { label: 'LLM judge',  color: '#f59e0b' },
};

const RUNS_DATA: Run[] = [
  { id: 'run-cmp-001', suite: 'Order & Shipping', agent: 'Customer Support', multiModel: true, status: 'completed', cases: 14, timestamp: 'Apr 24, 16:30', startedAt: '30m ago', evaluators: ['tool_call_match','semantic'], modelResults: [
    { model: 'gpt-4o', passed: 11, failed: 3, passRate: 79, duration: '24s', costUsd: 0.48, tokensIn: 11480, tokensOut: 5920 },
    { model: 'gpt-4o-mini', passed: 9, failed: 5, passRate: 64, duration: '18s', costUsd: 0.09, tokensIn: 11200, tokensOut: 5600 },
    { model: 'claude-3.5-sonnet', passed: 12, failed: 2, passRate: 86, duration: '31s', costUsd: 0.72, tokensIn: 11900, tokensOut: 6100 },
  ], caseResults: [] },
  { id: 'run-008', suite: 'Order & Shipping', agent: 'Customer Support', model: 'gpt-4o', status: 'completed', passRate: 82, prevPassRate: 75, cases: 14, passed: 11, failed: 3, duration: '24s', startedAt: '2h ago', timestamp: 'Apr 24, 14:12', evaluators: ['tool_call_match','semantic'], caseResults: [
    { id: 'tc-01', name: 'Order lookup — delayed',       pass: true,  score: 1.00, evaluator: 'tool_call_match', latency: 1512, note: 'Correct tool call with matching args' },
    { id: 'tc-02', name: 'Order lookup — not found',     pass: true,  score: 0.95, evaluator: 'semantic',        latency: 890,  note: 'Response semantically correct' },
    { id: 'tc-03', name: 'Refund initiation — gold',     pass: true,  score: 1.00, evaluator: 'tool_call_match', latency: 2105, note: 'issue_refund called correctly' },
    { id: 'tc-04', name: 'Escalation — frustrated user', pass: false, score: 0.41, evaluator: 'semantic',        latency: 3820, note: 'Missing empathy markers, wrong escalation priority' },
    { id: 'tc-05', name: 'Shipping ETA — backorder',     pass: true,  score: 0.88, evaluator: 'semantic',        latency: 1640, note: 'ETA communicated correctly' },
    { id: 'tc-06', name: 'Double charge — refund',       pass: true,  score: 1.00, evaluator: 'tool_call_match', latency: 2890, note: 'Full refund issued as expected' },
    { id: 'tc-07', name: 'Cancel order — already shipped', pass: false, score: 0.28, evaluator: 'tool_call_match', latency: 4200, note: 'Called wrong tool — escalate instead of cancel' },
    { id: 'tc-08', name: 'Delivery missing — P0',        pass: true,  score: 0.91, evaluator: 'semantic',        latency: 1980, note: 'Escalation triggered appropriately' },
    { id: 'tc-09', name: 'Promo code — expired',         pass: true,  score: 0.87, evaluator: 'semantic',        latency: 1220, note: 'Polite refusal with alternative offered' },
    { id: 'tc-10', name: 'Wrong item received',          pass: true,  score: 1.00, evaluator: 'tool_call_match', latency: 2340, note: 'Replacement order initiated' },
    { id: 'tc-11', name: 'International shipping delay', pass: false, score: 0.38, evaluator: 'semantic',        latency: 2910, note: 'Did not acknowledge customs delay root cause' },
    { id: 'tc-12', name: 'Gift order — surprise spoiler',pass: true,  score: 0.94, evaluator: 'semantic',        latency: 1450, note: 'Handled gracefully without spoiling' },
    { id: 'tc-13', name: 'Partial refund — damaged goods',pass: true, score: 1.00, evaluator: 'tool_call_match', latency: 1780, note: 'Correct partial amount calculated' },
    { id: 'tc-14', name: 'Repeat escalation — VIP',      pass: true,  score: 0.90, evaluator: 'semantic',        latency: 2660, note: 'Priority flag set correctly' },
  ] },
  { id: 'run-007', suite: 'Order & Shipping', agent: 'Customer Support', model: 'gpt-4o', status: 'completed', passRate: 75, prevPassRate: 68, cases: 14, passed: 10, failed: 4, duration: '26s', startedAt: '1d ago', timestamp: 'Apr 23, 09:44', evaluators: ['tool_call_match','semantic'], caseResults: [] },
  { id: 'run-005', suite: 'Bug Localisation', agent: 'Code Helper', model: 'gpt-4o-mini', status: 'completed', passRate: 73, prevPassRate: 65, cases: 11, passed: 8, failed: 3, duration: '31s', startedAt: '4h ago', timestamp: 'Apr 24, 12:08', evaluators: ['tool_call_match'], caseResults: [
    { id: 'tc-b01', name: 'Null deref — traces controller',  pass: true,  score: 1.00, evaluator: 'tool_call_match', latency: 2412, note: 'search_code → read_file in correct order' },
    { id: 'tc-b02', name: 'Race condition — token cache',    pass: false, score: 0.22, evaluator: 'tool_call_match', latency: 4900, note: 'Skipped search_code, jumped straight to fix' },
    { id: 'tc-b03', name: 'Off-by-one — pagination',        pass: true,  score: 1.00, evaluator: 'tool_call_match', latency: 3100, note: 'Correctly identified index error via read_file' },
    { id: 'tc-b04', name: 'SQL injection — raw query',       pass: true,  score: 0.95, evaluator: 'tool_call_match', latency: 2800, note: 'Recommended parameterised query correctly' },
    { id: 'tc-b05', name: 'Memory leak — event handler',    pass: false, score: 0.30, evaluator: 'tool_call_match', latency: 5200, note: 'Used wrong file path, fix was for wrong class' },
    { id: 'tc-b06', name: 'Deadlock — EF Core',             pass: true,  score: 0.88, evaluator: 'tool_call_match', latency: 3400, note: 'AsNoTracking suggestion accepted' },
    { id: 'tc-b07', name: 'Config parsing — null env',      pass: true,  score: 1.00, evaluator: 'tool_call_match', latency: 1900, note: 'Null-coalescing pattern applied correctly' },
    { id: 'tc-b08', name: 'Exception swallowed silently',   pass: true,  score: 0.91, evaluator: 'tool_call_match', latency: 2200, note: 'Rethrow suggestion with logging' },
    { id: 'tc-b09', name: 'Route ambiguity — 404',          pass: true,  score: 0.85, evaluator: 'tool_call_match', latency: 2600, note: 'Attribute routing fix proposed' },
    { id: 'tc-b10', name: 'Timeout — proxy forwarding',     pass: false, score: 0.15, evaluator: 'tool_call_match', latency: 6100, note: 'Did not identify network layer cause' },
    { id: 'tc-b11', name: 'Type mismatch — Guid vs string', pass: true,  score: 0.97, evaluator: 'tool_call_match', latency: 1800, note: 'Cast inserted correctly' },
  ] },
  { id: 'run-004', suite: 'Priority Routing', agent: 'Ticket Triage', model: 'claude-3.5-sonnet', status: 'completed', passRate: 78, prevPassRate: 70, cases: 18, passed: 14, failed: 4, duration: '19s', startedAt: '6h ago', timestamp: 'Apr 24, 10:35', evaluators: ['tool_call_match','exact'], caseResults: [] },
  { id: 'run-003', suite: 'Account & Billing', agent: 'Customer Support', model: 'gpt-4o', status: 'completed', passRate: 67, prevPassRate: 71, cases: 9, passed: 6, failed: 3, duration: '18s', startedAt: '1d ago', timestamp: 'Apr 23, 16:20', evaluators: ['semantic','llm_judge'], caseResults: [] },
  { id: 'run-001', suite: 'Category Labels', agent: 'Classifier', model: 'gpt-3.5-turbo', status: 'completed', passRate: 45, prevPassRate: null, cases: 22, passed: 10, failed: 12, duration: '14s', startedAt: '3d ago', timestamp: 'Apr 21, 11:05', evaluators: ['exact'], caseResults: [] },
];

@Component({
  selector: 'app-runs',
  templateUrl: './runs.html',
  styles: `:host { display: block; flex: 1; min-height: 0; overflow-y: auto; }`,
})
export class Runs {
  readonly Math = Math;
  readonly agentFilter = signal('All');
  readonly selectedRunId = signal(RUNS_DATA[0].id);

  readonly agentColors = AGENT_COLORS;
  readonly modelColors = MODEL_COLORS;
  readonly evaluatorMeta = EVALUATOR_META;

  readonly visible = computed(() => {
    const af = this.agentFilter();
    return af === 'All' ? RUNS_DATA : RUNS_DATA.filter(r => r.agent === af);
  });

  readonly selectedRun = computed(() => RUNS_DATA.find(r => r.id === this.selectedRunId()) ?? RUNS_DATA[0]);

  readonly avgPassRate = Math.round(
    RUNS_DATA.filter(r => !r.multiModel && r.passRate !== undefined)
      .reduce((n, r, _, a) => n + (r.passRate ?? 0) / a.length, 0)
  );

  agentTabLabels = ['All', 'Support', 'Code', 'Triage', 'Classifier'];
  agentTabValues = ['All', 'Customer Support', 'Code Helper', 'Ticket Triage', 'Classifier'];

  agentColor(agent: string) { return AGENT_COLORS[agent] ?? '#8b5cf6'; }
  modelColor(model: string) { return MODEL_COLORS[model] ?? '#888'; }
  passColor(rate: number | undefined) {
    if (rate === undefined) return 'var(--accent-primary)';
    return rate >= 75 ? 'var(--success)' : rate >= 55 ? 'var(--warn)' : 'var(--danger)';
  }
  passBarWidth(passed: number, total: number) { return total > 0 ? (passed / total) * 100 : 0; }
  formatLatency(ms: number) { return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`; }
  scoreColor(s: number) { return s >= 0.8 ? 'var(--success)' : s >= 0.5 ? 'var(--warn)' : 'var(--danger)'; }
  evaluatorLabel(ev: string) { return EVALUATOR_META[ev]?.label ?? ev; }
  evaluatorColor(ev: string) { return EVALUATOR_META[ev]?.color ?? '#888'; }

  // Multi-model comparison helpers
  bestModel(run: Run) { return run.modelResults?.reduce((a, b) => a.passRate > b.passRate ? a : b); }
  fastestModel(run: Run) { return run.modelResults?.reduce((a, b) => parseFloat(a.duration) < parseFloat(b.duration) ? a : b); }
  cheapestModel(run: Run) { return run.modelResults?.reduce((a, b) => a.costUsd < b.costUsd ? a : b); }
}
