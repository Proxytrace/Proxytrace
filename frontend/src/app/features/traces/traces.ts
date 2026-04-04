import { Component, signal, computed } from '@angular/core';

interface Trace {
  id: string;
  agent: string;
  model: string;
  latency: number;
  tokens: number;
  cost: number;
  status: 'success' | 'error';
  timestamp: string;
}

@Component({
  selector: 'app-traces',
  imports: [],
  templateUrl: './traces.html',
  styles: ``,
})
export class Traces {
  readonly searchQuery = signal('');
  readonly selectedStatus = signal<'all' | 'success' | 'error'>('all');

  readonly allTraces: Trace[] = [
    { id: 'trc_1a2b3c', agent: 'customer-support-v2', model: 'gpt-4o', latency: 1240, tokens: 1823, cost: 0.0147, status: 'success', timestamp: '2 min ago' },
    { id: 'trc_4d5e6f', agent: 'content-writer', model: 'claude-3-5-sonnet', latency: 890, tokens: 942, cost: 0.0064, status: 'success', timestamp: '5 min ago' },
    { id: 'trc_7g8h9i', agent: 'code-reviewer', model: 'gpt-4o', latency: 3200, tokens: 4521, cost: 0.0412, status: 'error', timestamp: '12 min ago' },
    { id: 'trc_jklmno', agent: 'customer-support-v2', model: 'gpt-4o', latency: 980, tokens: 1105, cost: 0.0089, status: 'success', timestamp: '18 min ago' },
    { id: 'trc_pqrstu', agent: 'summarizer', model: 'claude-3-haiku', latency: 320, tokens: 421, cost: 0.0021, status: 'success', timestamp: '25 min ago' },
    { id: 'trc_vwxyz1', agent: 'content-writer', model: 'claude-3-5-sonnet', latency: 1560, tokens: 2105, cost: 0.0143, status: 'success', timestamp: '31 min ago' },
    { id: 'trc_234567', agent: 'code-reviewer', model: 'gpt-4o', latency: 2800, tokens: 3892, cost: 0.0354, status: 'success', timestamp: '45 min ago' },
    { id: 'trc_890abc', agent: 'summarizer', model: 'claude-3-haiku', latency: 290, tokens: 380, cost: 0.0019, status: 'error', timestamp: '1 hr ago' },
    { id: 'trc_defghi', agent: 'customer-support-v2', model: 'gpt-4o', latency: 1100, tokens: 1560, cost: 0.0126, status: 'success', timestamp: '1 hr ago' },
    { id: 'trc_jklpqr', agent: 'content-writer', model: 'claude-3-5-sonnet', latency: 1890, tokens: 2740, cost: 0.0186, status: 'success', timestamp: '2 hrs ago' },
  ];

  readonly filtered = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const s = this.selectedStatus();
    return this.allTraces.filter((t) => {
      const matchesSearch = !q || t.id.includes(q) || t.agent.includes(q) || t.model.includes(q);
      const matchesStatus = s === 'all' || t.status === s;
      return matchesSearch && matchesStatus;
    });
  });

  onSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  setStatus(status: 'all' | 'success' | 'error') {
    this.selectedStatus.set(status);
  }

  formatLatency(ms: number): string {
    return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
  }

  formatCost(usd: number): string {
    return `$${usd.toFixed(4)}`;
  }
}
