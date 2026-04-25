import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { AgentCallsService } from '../../core/api/agent-calls.service';
import { AgentCallDto } from '../../core/api/models';

type LoadState = 'loading' | 'loaded' | 'error';

const PAGE_SIZE = 20;

interface HistBar { x: number; y: number; w: number; h: number; }

@Component({
  selector: 'app-traces',
  imports: [],
  templateUrl: './traces.html',
  styles: ``,
})
export class Traces implements OnInit {
  private readonly agentCallsService = inject(AgentCallsService);

  readonly searchQuery = signal('');
  readonly modelFilter = signal('All');
  readonly page = signal(1);
  readonly loadState = signal<LoadState>('loading');
  readonly traces = signal<AgentCallDto[]>([]);
  readonly total = signal(0);

  readonly filteredTraces = computed(() => {
    const mf = this.modelFilter();
    return mf === 'All' ? this.traces() : this.traces().filter(t => t.model === mf);
  });

  readonly modelSummaries = computed(() => {
    const map = new Map<string, number>();
    this.traces().forEach(t => map.set(t.model, (map.get(t.model) ?? 0) + 1));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).map(([model, count]) => ({ model, count }));
  });

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

  ngOnInit() { this.load(); }

  onSearch(event: Event) {
    this.searchQuery.set((event.target as HTMLInputElement).value);
    this.page.set(1);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), 300);
  }

  setModelFilter(m: string) { this.modelFilter.set(m); }

  prevPage() { if (this.hasPrev()) { this.page.update(p => p - 1); this.load(); } }
  nextPage() { if (this.hasNext()) { this.page.update(p => p + 1); this.load(); } }

  private load() {
    this.loadState.set('loading');
    this.agentCallsService.getAll({ model: this.searchQuery().trim() || undefined, page: this.page(), pageSize: PAGE_SIZE }).subscribe({
      next: (r) => { this.traces.set(r.items); this.total.set(r.total); this.loadState.set('loaded'); },
      error: () => this.loadState.set('error'),
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
  get pageNums() { return Array.from({ length: Math.min(5, this.totalPages()) }, (_, i) => i + 1); }
}
