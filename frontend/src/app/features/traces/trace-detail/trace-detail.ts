import { Component, Input, Output, EventEmitter, HostListener, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AgentCallDto, MessageDto, TestSuiteDto, ToolRequestDto, ToolSpecDto } from '../../../core/api/models';
import { TestSuitesService } from '../../../core/api/test-suites.service';

type Tab = 'Messages' | 'Raw JSON' | 'Metadata';
type PromoteState = 'idle' | 'open' | 'loading' | 'success' | 'error';

interface ToolInvocation {
  id: string;
  name: string;
  arguments: string;
  result: string | null;
}

type ConversationItem =
  | { kind: 'message'; msg: MessageDto }
  | { kind: 'tool-group'; invocations: ToolInvocation[] }
  | { kind: 'tools-spec'; tools: ToolSpecDto[] };

@Component({
  selector: 'app-trace-detail',
  imports: [],
  templateUrl: './trace-detail.html',
  styles: `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    @keyframes slide-in {
      from { transform: translateX(100%); opacity: 0; }
      to   { transform: translateX(0);    opacity: 1; }
    }
    @keyframes fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    .backdrop { animation: fade-in 0.18s ease-out; }
    .panel    { animation: slide-in 0.26s cubic-bezier(0.16, 1, 0.3, 1); }

    .tab-btn {
      padding: 9px 14px 11px;
      font-size: 12.5px;
      font-weight: 500;
      background: transparent;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: color 0.12s;
      white-space: nowrap;
    }
    .tab-btn:hover { color: var(--text-primary); }

    .tool-block button:hover { background: rgba(107,158,170,0.1) !important; }
    .result-block button:hover { background: rgba(6,182,212,0.08) !important; }

    .msg-bubble { transition: none; }

    :host ::ng-deep .json-null   { color: #a1a1aa; }
    :host ::ng-deep .json-bool   { color: #f472b6; }
    :host ::ng-deep .json-num    { color: var(--warn); }
    :host ::ng-deep .json-str    { color: #86efac; }
    :host ::ng-deep .json-key    { color: #93c5fd; }
    :host ::ng-deep .json-punct  { color: #636369; }
  `,
})
export class TraceDetail {
  @Input({ required: true }) trace!: AgentCallDto;
  @Output() closeDialog = new EventEmitter<void>();

  readonly activeTab = signal<Tab>('Messages');
  readonly copiedId = signal(false);
  readonly expandedMsgs = signal<Set<number>>(new Set());
  readonly expandedToolCalls = signal<Set<string>>(new Set());
  readonly expandedInvocations = signal<Set<string>>(new Set());
  readonly expandedToolSpecs = signal<Set<string>>(new Set());

  // ── Promote to test case ───────────────────────────────────────────────────
  readonly promoteState = signal<PromoteState>('idle');
  readonly suites = signal<TestSuiteDto[]>([]);
  readonly promoteError = signal('');

  private readonly testSuitesService = inject(TestSuitesService);
  readonly sanitizer = inject(DomSanitizer);
  private readonly router = inject(Router);

  readonly tabs: Tab[] = ['Messages', 'Raw JSON', 'Metadata'];

  @HostListener('document:keydown.escape')
  close() { this.closeDialog.emit(); }

  setTab(t: Tab) { this.activeTab.set(t); }

  toggleMsg(i: number) {
    const s = new Set(this.expandedMsgs());
    s.has(i) ? s.delete(i) : s.add(i);
    this.expandedMsgs.set(s);
  }

  isMsgExpanded(i: number): boolean { return this.expandedMsgs().has(i); }

  toggleToolCall(id: string) {
    const s = new Set(this.expandedToolCalls());
    s.has(id) ? s.delete(id) : s.add(id);
    this.expandedToolCalls.set(s);
  }

  isToolCallExpanded(id: string): boolean { return this.expandedToolCalls().has(id); }

  toggleInvocation(id: string) {
    const s = new Set(this.expandedInvocations());
    s.has(id) ? s.delete(id) : s.add(id);
    this.expandedInvocations.set(s);
  }

  isInvocationExpanded(id: string): boolean { return this.expandedInvocations().has(id); }

  toggleToolSpec(name: string) {
    const s = new Set(this.expandedToolSpecs());
    s.has(name) ? s.delete(name) : s.add(name);
    this.expandedToolSpecs.set(s);
  }

  isToolSpecExpanded(name: string): boolean { return this.expandedToolSpecs().has(name); }

  openPromote() {
    this.promoteState.set('loading');
    this.testSuitesService.getAll(this.trace.agentId).subscribe({
      next: (res) => { this.suites.set(res.items); this.promoteState.set('open'); },
      error: () => this.promoteState.set('idle'),
    });
  }

  cancelPromote() { this.promoteState.set('idle'); }

  promoteToSuite(suiteId: string) {
    this.promoteState.set('loading');
    this.testSuitesService.addTestCase(suiteId, this.trace.id).subscribe({
      next: () => {
        this.promoteState.set('success');
        setTimeout(() => this.promoteState.set('idle'), 2000);
      },
      error: (e) => { this.promoteError.set(e?.error?.detail ?? 'Request failed'); this.promoteState.set('error'); },
    });
  }

  promoteToNewSuite() {
    if (!this.trace.agentId) return;
    this.promoteState.set('loading');
    this.testSuitesService.createFromTrace(this.trace.agentId, this.trace.id).subscribe({
      next: () => {
        this.promoteState.set('success');
        setTimeout(() => this.promoteState.set('idle'), 2000);
      },
      error: (e) => { this.promoteError.set(e?.error?.detail ?? 'Request failed'); this.promoteState.set('error'); },
    });
  }

  formatSuiteLabel(s: TestSuiteDto): string {
    const n = s.testCases.length;
    const d = new Date(s.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    return `${n} case${n !== 1 ? 's' : ''} · ${d}`;
  }

  copyId() {
    navigator.clipboard.writeText(this.trace.id).then(() => {
      this.copiedId.set(true);
      setTimeout(() => this.copiedId.set(false), 1500);
    });
  }

  openAgent() {
    if (!this.trace.agentId) return;
    this.closeDialog.emit();
    this.router.navigate(['/agents'], { queryParams: { id: this.trace.agentId } });
  }

  // ── Conversation helpers ───────────────────────────────────────────────────

  get allMessages(): MessageDto[] { return this.trace.request ?? []; }

  get conversationItems(): ConversationItem[] {
    const msgs = this.allMessages;
    const resultByCallId = new Map<string, string>();
    for (const msg of msgs) {
      if (msg.role === 'tool' && msg.toolCallId) {
        resultByCallId.set(msg.toolCallId, msg.content);
      }
    }

    const items: ConversationItem[] = [];
    const tools = this.trace.tools ?? [];

    for (const msg of msgs) {
      if (msg.role === 'tool') continue;

      if (msg.role === 'assistant' && msg.toolRequests?.length > 0) {
        if (msg.content) {
          items.push({ kind: 'message', msg: { ...msg, toolRequests: [] } });
        }
        items.push({
          kind: 'tool-group',
          invocations: msg.toolRequests.map(tr => ({
            id: tr.id,
            name: tr.name,
            arguments: tr.arguments,
            result: resultByCallId.get(tr.id) ?? null,
          })),
        });
        continue;
      }

      items.push({ kind: 'message', msg });

      // Inject tool specs right after the system message
      if (msg.role === 'system' && tools.length > 0) {
        items.push({ kind: 'tools-spec', tools });
      }
    }

    return items;
  }

  isToolRoleMsg(msg: MessageDto): boolean { return msg.role === 'tool'; }

  hasToolRequests(msg: MessageDto): boolean {
    return msg.toolRequests?.length > 0;
  }

  tryParseJson(s: string | null | undefined): unknown | null {
    if (!s) return null;
    try { return JSON.parse(s); } catch { return null; }
  }

  toolResultContent(msg: MessageDto): unknown {
    const parsed = this.tryParseJson(msg.content);
    return parsed ?? msg.content;
  }

  toolRequestArgs(tr: { arguments: string }): unknown {
    const parsed = this.tryParseJson(tr.arguments);
    return parsed ?? tr.arguments;
  }

  // ── Style helpers ──────────────────────────────────────────────────────────

  roleColor(role: string): string {
    const c: Record<string, string> = {
      system: '#636369', user: '#6b9eaa', assistant: '#c9944a', tool: '#3daa6f',
    };
    return c[role] ?? '#a1a1aa';
  }

  roleBg(role: string): string {
    const c: Record<string, string> = {
      system:    'rgba(113,113,122,0.12)',
      user:      'rgba(6,182,212,0.14)',
      assistant: 'rgba(201,148,74,0.12)',
      tool:      'rgba(107,158,170,0.1)',
    };
    return c[role] ?? 'rgba(161,161,170,0.12)';
  }

  roleLabel(role: string): string {
    return { system: 'System', user: 'User', assistant: 'Assistant', tool: 'Tool Result' }[role] ?? role;
  }

  statusColor(s: number): string {
    return s === 200 ? 'var(--success)' : s >= 400 && s < 500 ? 'var(--warn)' : 'var(--danger)';
  }

  statusBg(s: number): string {
    return s === 200 ? 'var(--success-subtle)' : s >= 400 && s < 500 ? 'var(--warn-subtle)' : 'var(--danger-subtle)';
  }

  statusLabel(s: number): string {
    if (s === 200) return 'OK';
    if (s === 429) return 'RATE_LIMIT';
    if (s >= 500)  return 'ERROR';
    return String(s);
  }

  modelColor(model: string): string {
    const c: Record<string, string> = {
      'gpt-4o': '#c9944a', 'gpt-4o-mini': '#6b9eaa',
      'gpt-3.5-turbo': '#d4915c', 'claude-3.5-sonnet': '#3daa6f',
    };
    return c[model] ?? '#a1a1aa';
  }

  // ── Formatting ─────────────────────────────────────────────────────────────

  formatLatency(ms: number): string {
    return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }

  formatCost(eur: number | null): string {
    if (eur == null) return '—';
    if (eur < 0.0001) return `€${eur.toExponential(2)}`;
    if (eur < 0.01)   return `€${eur.toFixed(5)}`;
    return `€${eur.toFixed(4)}`;
  }

  // ── JSON syntax highlighting ───────────────────────────────────────────────

  highlightedJson(value: unknown): string {
    const raw = JSON.stringify(value, null, 2);
    return raw
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
        (match) => {
          if (/^"/.test(match)) {
            if (/:$/.test(match)) return `<span class="json-key">${match}</span>`;
            return `<span class="json-str">${match}</span>`;
          }
          if (/true|false/.test(match)) return `<span class="json-bool">${match}</span>`;
          if (/null/.test(match))       return `<span class="json-null">${match}</span>`;
          return `<span class="json-num">${match}</span>`;
        })
      .replace(/[{}\[\],]/g, m => `<span class="json-punct">${m}</span>`);
  }

  get rawJsonHtml(): SafeHtml {
    const t = this.trace;
    return this.sanitizer.bypassSecurityTrustHtml(this.highlightedJson({
      id: t.id,
      model: t.model,
      provider: t.provider,
      httpStatus: t.httpStatus,
      finishReason: t.finishReason,
      durationMs: t.durationMs,
      usage: { inputTokens: t.inputTokens, outputTokens: t.outputTokens },
      costEur: t.costEur,
      messages: [
        ...t.request,
        { ...t.response, role: 'assistant' },
      ],
      errorMessage: t.errorMessage ?? undefined,
      createdAt: t.createdAt,
    }));
  }

  get metadataRows(): Array<[string, string]> {
    const t = this.trace;
    return [
      ['trace.id',      t.id],
      ['model',         t.model],
      ['provider',      t.provider],
      ['http_status',   String(t.httpStatus)],
      ['finish_reason', t.finishReason ?? '—'],
      ['latency',       this.formatLatency(t.durationMs)],
      ['input_tokens',  t.inputTokens.toLocaleString()],
      ['output_tokens', t.outputTokens.toLocaleString()],
      ['total_tokens',  (t.inputTokens + t.outputTokens).toLocaleString()],
      ['cost',          this.formatCost(t.costEur)],
      ['agent_id',      t.agentId ?? '—'],
      ['created_at',    this.formatDate(t.createdAt)],
    ];
  }
}
