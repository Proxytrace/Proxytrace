import { Component, signal, computed } from '@angular/core';

interface Agent {
  name: string;
  description: string;
  model: string;
  traces: number;
  errorRate: number;
  avgLatency: number;
  lastSeen: string;
  status: 'active' | 'idle';
}

@Component({
  selector: 'app-agents',
  imports: [],
  templateUrl: './agents.html',
  styles: ``,
})
export class Agents {
  readonly searchQuery = signal('');

  readonly allAgents: Agent[] = [
    {
      name: 'customer-support-v2',
      description: 'Handles customer support tickets, FAQs, and escalation routing.',
      model: 'gpt-4o',
      traces: 512,
      errorRate: 2.1,
      avgLatency: 1100,
      lastSeen: '2 min ago',
      status: 'active',
    },
    {
      name: 'content-writer',
      description: 'Generates long-form blog posts, product descriptions, and marketing copy.',
      model: 'claude-3-5-sonnet',
      traces: 289,
      errorRate: 0.7,
      avgLatency: 1340,
      lastSeen: '5 min ago',
      status: 'active',
    },
    {
      name: 'code-reviewer',
      description: 'Automated code review with security scanning and best-practice suggestions.',
      model: 'gpt-4o',
      traces: 198,
      errorRate: 4.5,
      avgLatency: 2900,
      lastSeen: '12 min ago',
      status: 'active',
    },
    {
      name: 'summarizer',
      description: 'Condenses long documents, meeting notes, and research papers.',
      model: 'claude-3-haiku',
      traces: 249,
      errorRate: 1.2,
      avgLatency: 305,
      lastSeen: '25 min ago',
      status: 'idle',
    },
  ];

  readonly filtered = computed(() => {
    const q = this.searchQuery().toLowerCase();
    if (!q) return this.allAgents;
    return this.allAgents.filter(
      (a) => a.name.includes(q) || a.model.includes(q) || a.description.toLowerCase().includes(q)
    );
  });

  onSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  formatLatency(ms: number): string {
    return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
  }
}
