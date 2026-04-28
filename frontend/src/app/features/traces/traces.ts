import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { AgentCallsService } from '../../core/api/agent-calls.service';
import { AgentsService } from '../../core/api/agents.service';
import { StatisticsService } from '../../core/api/statistics.service';
import { AgentCallDto, AgentDto } from '../../core/api/models';
import { TraceDetail } from './trace-detail/trace-detail';

type LoadState = 'loading' | 'loaded' | 'error';

const PAGE_SIZE = 20;
const POLL_INTERVAL_MS = 5000;

interface HistBar { x: number; y: number; w: number; h: number; }

@Component({
  selector: 'app-traces',
  imports: [TraceDetail],
  templateUrl: './traces.html',
  styles: ``,
})
export class Traces implements OnInit, OnDestroy {
  private readonly agentCallsService = inject(AgentCallsService);
  private readonly agentsService = inject(AgentsService);
  private readonly statisticsService = inject(StatisticsService);

  readonly searchQuery = signal('');
  readonly agentFilter = signal<AgentDto | null>(null);
  readonly agentDropdownOpen = signal(false);
  readonly page = signal(1);
  readonly loadState = signal<LoadState>('loading');
  readonly traces = signal<AgentCallDto[]>([]);
  readonly total = signal(0);
  readonly agents = signal<AgentDto[]>([]);
  readonly selectedTrace = signal<AgentCallDto | null>(null);
  readonly modelSummaries = signal<{ model: string; count: number }[]>([]);
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  readonly totalPages = computed(() => Math.ceil(this.total() / PAGE_SIZE));
  readonly hasPrev = computed(() => this.page() > 1);
  readonly hasNext = computed(() => this.page() < this.totalPages());
  readonly rangeStart = computed(() => this.total() === 0 ? 0 : (this.page() - 1) * PAGE_SIZE + 1);
  readonly rangeEnd = computed(() => Math.min(this.page() * PAGE_SIZE, this.total()));

  readonly histBars: HistBar[];
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const hist = [4, 12, 28, 42, 32, 22, 11, 7, 3, 2];
    const W = 280, H = 56;
    const max = Math.max(...hist) * 1.1;
    const bw = W / hist.length * 0.86, gap = W / hist.length * 0.14;
    this.histBars = hist.map((v, i) => ({
      x: i * (bw + gap) + gap / 2, w: bw,
      y: H - (v / max) * H, h: (v / max) * H,
    }));
  }

  ngOnInit() {
    this.agentsService.getAll().subscribe({ next: (r) => this.agents.set(r.items) });
    this.loadModelBreakdown();
    this.load();
    this.pollTimer = setInterval(() => this.refresh(), POLL_INTERVAL_MS);
  }

  ngOnDestroy() {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  onSearch(event: Event) {
    this.searchQuery.set((event.target as HTMLInputElement).value);
    this.page.set(1);
    this.agentDropdownOpen.set(false);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), 300);
  }

  filterByModel(model: string) {
    this.searchQuery.set(this.searchQuery() === model ? '' : model);
    this.page.set(1);
    this.load();
  }

  setAgentFilter(agent: AgentDto | null) {
    this.agentFilter.set(agent);
    this.agentDropdownOpen.set(false);
    this.page.set(1);
    this.loadModelBreakdown();
    this.load();
  }

  toggleAgentDropdown() { this.agentDropdownOpen.update(v => !v); }
  closeAgentDropdown() { this.agentDropdownOpen.set(false); }

  agentLabel(agent: AgentDto): string {
    const text = agent.systemMessage.trim();
    return text.length > 48 ? text.slice(0, 48) + '…' : text || agent.id.slice(0, 8);
  }

  openTrace(t: AgentCallDto) { this.selectedTrace.set(t); }
  closeTrace() { this.selectedTrace.set(null); }

  prevPage() { if (this.hasPrev()) { this.page.update(p => p - 1); this.load(); } }
  nextPage() { if (this.hasNext()) { this.page.update(p => p + 1); this.load(); } }

  private buildFilter() {
    return {
      model: this.searchQuery().trim() || undefined,
      agentId: this.agentFilter()?.id ?? undefined,
      page: this.page(),
      pageSize: PAGE_SIZE,
    };
  }

  private loadModelBreakdown() {
    this.statisticsService.getModelBreakdown().subscribe({
      next: (items) => this.modelSummaries.set(
        items.map(i => ({ model: i.modelName, count: i.callCount }))
      ),
    });
  }

  private load() {
    this.loadState.set('loading');
    this.agentCallsService.getAll(this.buildFilter()).subscribe({
      next: (r) => { this.traces.set(r.items); this.total.set(r.total); this.loadState.set('loaded'); },
      error: () => this.loadState.set('error'),
    });
  }

  private refresh() {
    this.agentCallsService.getAll(this.buildFilter()).subscribe({
      next: (r) => { this.traces.set(r.items); this.total.set(r.total); this.loadState.set('loaded'); },
    });
  }

  truncateId(id: string) { return id.substring(0, 8) + '…' + id.substring(id.length - 4); }
  formatLatency(ms: number) { return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`; }
  formatDate(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ago`;
  }
  modelColor(model: string): string {
    const c: Record<string, string> = {
      'gpt-4o': '#8b5cf6', 'gpt-4o-mini': '#06b6d4',
      'gpt-3.5-turbo': '#f59e0b', 'claude-3.5-sonnet': '#10b981',
    };
    return c[model] ?? '#888888';
  }
  statusColor(s: number) { return s === 200 ? 'var(--success)' : s >= 400 && s < 500 ? 'var(--warn)' : 'var(--danger)'; }
  latencyBarPct(ms: number) { return Math.min(100, ms / 50); }

  readonly pageNums = computed((): Array<number | null> => {
    const total = this.totalPages();
    const current = this.page();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const pages: Array<number | null> = [1];
    const start = Math.max(2, current - 2);
    const end = Math.min(total - 1, current + 2);
    if (start > 2) pages.push(null);
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < total - 1) pages.push(null);
    pages.push(total);
    return pages;
  });

  goToPage(p: number) { this.page.set(p); this.load(); }
}
