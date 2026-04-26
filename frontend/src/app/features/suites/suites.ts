import { Component, signal, computed } from '@angular/core';

interface Suite {
  id: string; agent: string; name: string; description: string;
  cases: number; lastRun: string; lastRunId: string | null;
  passRate: number | null; prevPassRate: number | null;
  runs: number; trend: number[];
  evaluators: string[]; tags: string[]; createdAt: string;
}
interface SparklineData { path: string; endX: number; endY: number; }

const AGENT_COLORS: Record<string, string> = {
  'Customer Support': '#8b5cf6', 'Code Helper': '#06b6d4',
  'Ticket Triage': '#10b981', 'Classifier': '#f59e0b',
};
const EVALUATOR_META: Record<string, { label: string; color: string }> = {
  tool_call_match: { label: 'Tool match', color: '#10b981' },
  semantic:        { label: 'Semantic',   color: '#8b5cf6' },
  exact:           { label: 'Exact',      color: '#06b6d4' },
  llm_judge:       { label: 'LLM judge',  color: '#f59e0b' },
};

const SUITES_DATA: Suite[] = [
  { id: 'suite-cs-001', agent: 'Customer Support', name: 'Order & Shipping', description: 'Covers order lookup, delay handling, refund initiation, and escalation scenarios.', cases: 14, lastRun: '2h ago', lastRunId: 'run-008', passRate: 82, prevPassRate: 75, runs: 8, trend: [42,55,61,68,72,75,80,82], evaluators: ['tool_call_match','semantic'], tags: ['order','refund','escalation'], createdAt: 'Apr 18' },
  { id: 'suite-cs-002', agent: 'Customer Support', name: 'Account & Billing', description: 'Tests account lookup, invoice questions, VAT correction, and payment failure flows.', cases: 9, lastRun: '1d ago', lastRunId: 'run-003', passRate: 67, prevPassRate: 71, runs: 3, trend: [55,60,67], evaluators: ['semantic','llm_judge'], tags: ['billing','account','vat'], createdAt: 'Apr 20' },
  { id: 'suite-code-001', agent: 'Code Helper', name: 'Bug Localisation', description: 'Validates the agent correctly uses search_code + read_file before proposing a fix.', cases: 11, lastRun: '4h ago', lastRunId: 'run-005', passRate: 73, prevPassRate: 65, runs: 5, trend: [40,50,58,65,73], evaluators: ['tool_call_match'], tags: ['tool-use','search','csharp'], createdAt: 'Apr 19' },
  { id: 'suite-code-002', agent: 'Code Helper', name: 'Refactor Suggestions', description: 'Checks that refactor advice is semantically correct and does not break function signatures.', cases: 6, lastRun: 'Never', lastRunId: null, passRate: null, prevPassRate: null, runs: 0, trend: [], evaluators: ['semantic','llm_judge'], tags: ['refactor','quality'], createdAt: 'Apr 23' },
  { id: 'suite-triage-001', agent: 'Ticket Triage', name: 'Priority Routing', description: 'Verifies correct P0–P3 assignment and team routing for enterprise vs. free-tier tickets.', cases: 18, lastRun: '6h ago', lastRunId: 'run-004', passRate: 78, prevPassRate: 70, runs: 4, trend: [50,62,70,78], evaluators: ['tool_call_match','exact'], tags: ['routing','priority','sla'], createdAt: 'Apr 17' },
  { id: 'suite-cls-001', agent: 'Classifier', name: 'Category Labels', description: 'Checks JSON output has correct category + confidence for billing, bug, feature, and other classes.', cases: 22, lastRun: '3d ago', lastRunId: 'run-001', passRate: 45, prevPassRate: 52, runs: 1, trend: [45], evaluators: ['exact'], tags: ['json','classification','confidence'], createdAt: 'Apr 14' },
];

@Component({
  selector: 'app-suites',
  templateUrl: './suites.html',
  styles: ``,
})
export class Suites {
  readonly Math = Math;
  readonly agentFilter = signal('All');
  readonly runTargetId = signal<string | null>(null);
  readonly runModalState = signal<'idle' | 'running' | 'done'>('idle');

  readonly agentList = ['All', ...Object.keys(AGENT_COLORS)];
  readonly agentColors = AGENT_COLORS;
  readonly evaluatorMeta = EVALUATOR_META;
  readonly suitesData = SUITES_DATA;

  readonly visible = computed(() => {
    const af = this.agentFilter();
    return af === 'All' ? SUITES_DATA : SUITES_DATA.filter(s => s.agent === af);
  });

  readonly runTarget = computed(() => SUITES_DATA.find(s => s.id === this.runTargetId()) ?? null);

  readonly totalCases = SUITES_DATA.reduce((n, s) => n + s.cases, 0);
  readonly totalRuns  = SUITES_DATA.reduce((n, s) => n + s.runs, 0);
  readonly avgPass = Math.round(SUITES_DATA.filter(s => s.passRate !== null).reduce((n, s, _, a) => n + (s.passRate ?? 0) / a.length, 0));

  agentCount(agent: string) { return agent === 'All' ? SUITES_DATA.length : SUITES_DATA.filter(s => s.agent === agent).length; }
  agentColor(agent: string) { return AGENT_COLORS[agent] ?? '#8b5cf6'; }
  passColor(rate: number | null): string {
    if (rate === null) return 'var(--text-muted)';
    return rate >= 75 ? 'var(--success)' : rate >= 55 ? 'var(--warn)' : 'var(--danger)';
  }
  delta(suite: Suite): number | null {
    if (suite.passRate === null || suite.prevPassRate === null) return null;
    return suite.passRate - suite.prevPassRate;
  }
  sparklinePath(data: number[]): SparklineData {
    if (!data.length) return { path: '', endX: 0, endY: 0 };
    const W = 80, H = 20;
    const max = Math.max(...data), min = Math.min(...data);
    const range = max - min || 1;
    const stepX = W / (data.length - 1);
    const pts = data.map((v, i) => [i * stepX, H - ((v - min) / range) * H]);
    const path = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    return { path, endX: pts[pts.length-1][0], endY: pts[pts.length-1][1] };
  }

  openRunModal(suiteId: string) { this.runTargetId.set(suiteId); this.runModalState.set('idle'); }
  closeModal() { this.runTargetId.set(null); this.runModalState.set('idle'); }
  startRun() {
    this.runModalState.set('running');
    setTimeout(() => this.runModalState.set('done'), 1800);
  }
}
