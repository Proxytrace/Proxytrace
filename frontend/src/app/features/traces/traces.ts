import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { AgentCallsService } from '../../core/api/agent-calls.service';
import { AgentCallDto } from '../../core/api/models';

type LoadState = 'loading' | 'loaded' | 'error';

const PAGE_SIZE = 25;

@Component({
  selector: 'app-traces',
  imports: [],
  templateUrl: './traces.html',
  styles: ``,
})
export class Traces implements OnInit {
  private readonly agentCallsService = inject(AgentCallsService);

  readonly searchQuery = signal('');
  readonly page = signal(1);
  readonly loadState = signal<LoadState>('loading');
  readonly traces = signal<AgentCallDto[]>([]);
  readonly total = signal(0);

  readonly totalPages = computed(() => Math.ceil(this.total() / PAGE_SIZE));
  readonly hasPrev = computed(() => this.page() > 1);
  readonly hasNext = computed(() => this.page() < this.totalPages());
  readonly rangeStart = computed(() => this.total() === 0 ? 0 : (this.page() - 1) * PAGE_SIZE + 1);
  readonly rangeEnd = computed(() => Math.min(this.page() * PAGE_SIZE, this.total()));

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit() {
    this.load();
  }

  onSearch(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
    this.page.set(1);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), 300);
  }

  prevPage() {
    if (this.hasPrev()) {
      this.page.update(p => p - 1);
      this.load();
    }
  }

  nextPage() {
    if (this.hasNext()) {
      this.page.update(p => p + 1);
      this.load();
    }
  }

  private load() {
    this.loadState.set('loading');
    const q = this.searchQuery().trim();
    this.agentCallsService.getAll({
      model: q || undefined,
      page: this.page(),
      pageSize: PAGE_SIZE,
    }).subscribe({
      next: (result) => {
        this.traces.set(result.items);
        this.total.set(result.total);
        this.loadState.set('loaded');
      },
      error: () => this.loadState.set('error'),
    });
  }

  formatLatency(ms: number): string {
    return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString();
  }

  truncateId(id: string): string {
    return id.substring(0, 8) + '…';
  }

  statusClass(status: number): string {
    if (status >= 200 && status < 300) return 'text-green-600';
    if (status >= 400) return 'text-red-500';
    return '';
  }
}
