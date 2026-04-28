import { Component, Input, Output, EventEmitter, HostListener, signal, computed, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AgentCallDto, MessageDto } from '../../../core/api/models';

type Tab = 'Messages' | 'Raw JSON' | 'Metadata';

@Component({
  selector: 'app-trace-detail',
  imports: [],
  templateUrl: './trace-detail.html',
  styles: `
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

    .tool-block button:hover { background: rgba(16,185,129,0.08) !important; }
    .result-block button:hover { background: rgba(6,182,212,0.08) !important; }

    .msg-bubble { transition: none; }

    :host ::ng-deep .json-null   { color: #a1a1aa; }
    :host ::ng-deep .json-bool   { color: #f472b6; }
    :host ::ng-deep .json-num    { color: #fbbf24; }
    :host ::ng-deep .json-str    { color: #86efac; }
    :host ::ng-deep .json-key    { color: #93c5fd; }
    :host ::ng-deep .json-punct  { color: #71717a; }
  `,
})
export class TraceDetail {
  @Input({ required: true }) trace!: AgentCallDto;
  @Output() closeDialog = new EventEmitter<void>();

  readonly activeTab = signal<Tab>('Messages');
  readonly copiedId = signal(false);
  readonly expandedMsgs = signal<Set<number>>(new Set());

  private readonly sanitizer = inject(DomSanitizer);

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

  copyId() {
    navigator.clipboard.writeText(this.trace.id).then(() => {
      this.copiedId.set(true);
      setTimeout(() => this.copiedId.set(false), 1500);
    });
  }

  // ── Conversation helpers ───────────────────────────────────────────────────

  get allMessages(): MessageDto[] { return this.trace.request ?? []; }

  isToolRoleMsg(msg: MessageDto): boolean { return msg.role === 'tool'; }

  tryParseJson(s: string | null | undefined): unknown | null {
    if (!s) return null;
    try { return JSON.parse(s); } catch { return null; }
  }

  toolResultContent(msg: MessageDto): unknown {
    const parsed = this.tryParseJson(msg.content);
    return parsed ?? msg.content;
  }

  // ── Style helpers ──────────────────────────────────────────────────────────

  roleColor(role: string): string {
    const c: Record<string, string> = {
      system: '#71717a', user: '#06b6d4', assistant: '#8b5cf6', tool: '#10b981',
    };
    return c[role] ?? '#a1a1aa';
  }

  roleBg(role: string): string {
    const c: Record<string, string> = {
      system:    'rgba(113,113,122,0.12)',
      user:      'rgba(6,182,212,0.14)',
      assistant: 'rgba(139,92,246,0.14)',
      tool:      'rgba(16,185,129,0.12)',
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
      'gpt-4o': '#8b5cf6', 'gpt-4o-mini': '#06b6d4',
      'gpt-3.5-turbo': '#f59e0b', 'claude-3.5-sonnet': '#10b981',
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
