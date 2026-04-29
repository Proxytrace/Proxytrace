import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { AgentCallsService } from '../../core/api/agent-calls.service';
import { AgentsService } from '../../core/api/agents.service';
import { StatisticsService } from '../../core/api/statistics.service';
import { HealthService } from '../../core/api/health.service';
import { AgentCallDto, AgentDto, LatencyStatDto } from '../../core/api/models';
import { TraceDetail } from './trace-detail/trace-detail';

type LoadState = 'loading' | 'loaded' | 'error';

const PAGE_SIZE = 20;
const POLL_INTERVAL_MS = 5000;
const HIST_W = 280, HIST_H = 56, HIST_BUCKETS = 10;

interface HistBar { x: number; y: number; w: number; h: number; label: string; pct: number; count: number; }

@Component({
  selector: 'app-traces',
  imports: [TraceDetail],
  templateUrl: './traces.html',
  styles: `:host { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }`,
})
export class Traces implements OnInit, OnDestroy {
  private readonly agentCallsService = inject(AgentCallsService);
  private readonly agentsService = inject(AgentsService);
  private readonly statisticsService = inject(StatisticsService);
  readonly health = inject(HealthService);

  readonly searchQuery = signal('');
  readonly agentFilter = signal<AgentDto | null>(null);
  readonly agentDropdownOpen = signal(false);
  readonly rangeDropdownOpen = signal(false);
  readonly rangeKey = signal<string>('24h');
  readonly page = signal(1);

  readonly ranges: Array<{ key: string; label: string }> = [
    { key: '1h',  label: 'Last 1 hour' },
    { key: '24h', label: 'Last 24 hours' },
    { key: '7d',  label: 'Last 7 days' },
    { key: '30d', label: 'Last 30 days' },
    { key: 'all', label: 'All time' },
  ];
  readonly loadState = signal<LoadState>('loading');
  readonly traces = signal<AgentCallDto[]>([]);
  readonly total = signal(0);
  readonly agents = signal<AgentDto[]>([]);
  readonly selectedTrace = signal<AgentCallDto | null>(null);
  readonly modelSummaries = signal<{ model: string; count: number }[]>([]);
  readonly latencyStats = signal<LatencyStatDto | null>(null);
  readonly hoveredBar = signal<HistBar | null>(null);

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly totalPages = computed(() => Math.ceil(this.total() / PAGE_SIZE));
  readonly hasPrev = computed(() => this.page() > 1);
  readonly hasNext = computed(() => this.page() < this.totalPages());
  readonly rangeStart = computed(() => this.total() === 0 ? 0 : (this.page() - 1) * PAGE_SIZE + 1);
  readonly rangeEnd = computed(() => Math.min(this.page() * PAGE_SIZE, this.total()));

  // Histogram bars derived from real latency percentile data.
  // Uses a piecewise-linear CDF over [min, p50, p95, p99, max] to estimate
  // per-bucket density, giving a faithful shape without needing raw samples.
  readonly histBars = computed((): HistBar[] => {
    const s = this.latencyStats();
    if (!s || s.sampleCount === 0) return this.emptyHistBars();
    return this.histFromPercentiles(s);
  });

  readonly p95Label = computed((): string => {
    const s = this.latencyStats();
    if (!s) return '—';
    return this.formatLatency(s.p95Ms);
  });

  ngOnInit() {
    this.agentsService.getAll().subscribe({ next: (r) => this.agents.set(r.items) });
    this.loadStats();
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
    this.loadStats();
    this.load();
  }

  toggleAgentDropdown() { this.agentDropdownOpen.update(v => !v); this.rangeDropdownOpen.set(false); }
  closeAgentDropdown() { this.agentDropdownOpen.set(false); }
  toggleRangeDropdown() { this.rangeDropdownOpen.update(v => !v); this.agentDropdownOpen.set(false); }
  closeRangeDropdown() { this.rangeDropdownOpen.set(false); }
  setRange(key: string) { this.rangeKey.set(key); this.rangeDropdownOpen.set(false); this.page.set(1); this.loadStats(); this.load(); }
  rangeLabelFor(key: string): string { return this.ranges.find(r => r.key === key)?.label ?? key; }

  private fromIso(): string | undefined {
    const now = new Date();
    switch (this.rangeKey()) {
      case '1h':  now.setHours(now.getHours() - 1); return now.toISOString();
      case '24h': now.setHours(now.getHours() - 24); return now.toISOString();
      case '7d':  now.setDate(now.getDate() - 7); return now.toISOString();
      case '30d': now.setDate(now.getDate() - 30); return now.toISOString();
      default:    return undefined;
    }
  }

  agentLabel(agent: AgentDto): string {
    return agent.name || agent.id.slice(0, 8);
  }

  openTrace(t: AgentCallDto) { this.selectedTrace.set(t); }
  closeTrace() { this.selectedTrace.set(null); }

  prevPage() { if (this.hasPrev()) { this.page.update(p => p - 1); this.load(); } }
  nextPage() { if (this.hasNext()) { this.page.update(p => p + 1); this.load(); } }

  private statsFilter() {
    return { from: this.fromIso(), agentId: this.agentFilter()?.id };
  }

  private buildFilter() {
    return {
      model: this.searchQuery().trim() || undefined,
      agentId: this.agentFilter()?.id ?? undefined,
      from: this.fromIso(),
      page: this.page(),
      pageSize: PAGE_SIZE,
    };
  }

  private loadStats() {
    const filter = this.statsFilter();
    this.statisticsService.getModelBreakdown(filter).subscribe({
      next: (items) => this.modelSummaries.set(items.map(i => ({ model: i.modelName, count: i.callCount }))),
    });
    this.statisticsService.getLatency(filter).subscribe({
      next: (items) => this.latencyStats.set(this.aggregateLatency(items)),
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

  // Aggregate per-endpoint latency stats into one overall stat.
  // Percentiles are weighted by sample count; min/max are global extremes.
  private aggregateLatency(items: LatencyStatDto[]): LatencyStatDto | null {
    if (items.length === 0) return null;
    const total = items.reduce((s, i) => s + i.sampleCount, 0);
    if (total === 0) return null;
    const w = (field: keyof LatencyStatDto) =>
      items.reduce((s, i) => s + (i[field] as number) * i.sampleCount, 0) / total;
    return {
      endpointId: '',
      p50Ms: w('p50Ms'),
      p95Ms: w('p95Ms'),
      p99Ms: w('p99Ms'),
      minMs: Math.min(...items.map(i => i.minMs)),
      maxMs: Math.max(...items.map(i => i.maxMs)),
      sampleCount: total,
    };
  }

  // Build histogram bars from percentile landmarks using a piecewise-linear CDF.
  // Buckets span [0, chartMax] evenly; each bucket height = CDF(right) - CDF(left).
  private histFromPercentiles(s: LatencyStatDto): HistBar[] {
    const chartMax = Math.max(s.maxMs, s.p99Ms * 1.3);
    const bucketMs = chartMax / HIST_BUCKETS;

    // CDF landmark pairs [ms, percentile]
    const cdf: [number, number][] = [
      [0, 0],
      [s.minMs, 0],
      [s.p50Ms, 50],
      [s.p95Ms, 95],
      [s.p99Ms, 99],
      [chartMax, 100],
    ];

    const pctAt = (x: number): number => {
      for (let i = 1; i < cdf.length; i++) {
        const [x0, p0] = cdf[i - 1], [x1, p1] = cdf[i];
        if (x <= x1) {
          const t = x1 === x0 ? 1 : (x - x0) / (x1 - x0);
          return p0 + t * (p1 - p0);
        }
      }
      return 100;
    };

    const buckets = Array.from({ length: HIST_BUCKETS }, (_, i) => {
      const lo = i * bucketMs, hi = (i + 1) * bucketMs;
      return {
        pct: pctAt(hi) - pctAt(lo),
        label: `${this.formatLatency(lo)} – ${this.formatLatency(hi)}`,
        count: Math.round((pctAt(hi) - pctAt(lo)) / 100 * s.sampleCount),
      };
    });
    return this.barsFromBuckets(buckets);
  }

  private emptyHistBars(): HistBar[] {
    const buckets = Array.from({ length: HIST_BUCKETS }, (_, i) => ({
      pct: 0, count: 0, label: `bucket ${i + 1}`,
    }));
    return this.barsFromBuckets(buckets);
  }

  private barsFromBuckets(buckets: { pct: number; label: string; count: number }[]): HistBar[] {
    const maxPct = Math.max(...buckets.map(b => b.pct), 1);
    const bw = HIST_W / buckets.length * 0.86;
    const gap = HIST_W / buckets.length * 0.14;
    return buckets.map((b, i) => {
      const h = (b.pct / maxPct) * HIST_H;
      return { x: i * (bw + gap) + gap / 2, w: bw, y: HIST_H - h, h, label: b.label, pct: b.pct, count: b.count };
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
