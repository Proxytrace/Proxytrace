import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface StatCard {
  label: string;
  value: string;
  delta: string;
  positive: boolean;
  icon: string;
}

interface RecentTrace {
  id: string;
  agent: string;
  model: string;
  latency: number;
  tokens: number;
  status: 'success' | 'error';
  timestamp: string;
}

interface AgentSummary {
  name: string;
  traces: number;
  model: string;
  errorRate: number;
}

interface OptimizationInsight {
  title: string;
  detail: string;
  impact: 'high' | 'medium' | 'low';
  agent: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styles: ``,
})
export class Dashboard {
  readonly stats: StatCard[] = [
    { label: 'Total Traces', value: '1,248', delta: '+12% vs last week', positive: true, icon: 'activity' },
    { label: 'Active Agents', value: '4', delta: '+1 this week', positive: true, icon: 'agents' },
    { label: 'Test Suites', value: '3', delta: '73 test cases total', positive: true, icon: 'clipboard' },
    { label: 'Avg Latency', value: '1.1s', delta: '−80ms vs last week', positive: true, icon: 'clock' },
  ];

  readonly recentTraces: RecentTrace[] = [
    { id: 'trc_1a2b3c', agent: 'customer-support-v2', model: 'gpt-4o', latency: 1240, tokens: 1823, status: 'success', timestamp: '2 min ago' },
    { id: 'trc_4d5e6f', agent: 'content-writer', model: 'claude-3-5-sonnet', latency: 890, tokens: 942, status: 'success', timestamp: '5 min ago' },
    { id: 'trc_7g8h9i', agent: 'code-reviewer', model: 'gpt-4o', latency: 3200, tokens: 4521, status: 'error', timestamp: '12 min ago' },
    { id: 'trc_jklmno', agent: 'customer-support-v2', model: 'gpt-4o', latency: 980, tokens: 1105, status: 'success', timestamp: '18 min ago' },
    { id: 'trc_pqrstu', agent: 'summarizer', model: 'claude-3-haiku', latency: 320, tokens: 421, status: 'success', timestamp: '25 min ago' },
  ];

  readonly topAgents: AgentSummary[] = [
    { name: 'customer-support-v2', traces: 512, model: 'gpt-4o', errorRate: 2.1 },
    { name: 'content-writer', traces: 289, model: 'claude-3-5-sonnet', errorRate: 0.7 },
    { name: 'code-reviewer', traces: 198, model: 'gpt-4o', errorRate: 4.5 },
    { name: 'summarizer', traces: 249, model: 'claude-3-haiku', errorRate: 1.2 },
  ];

  readonly insights: OptimizationInsight[] = [
    {
      title: 'High error rate on code-reviewer',
      detail: '4.5% error rate detected — consider adding retry logic or tightening output format instructions.',
      impact: 'high',
      agent: 'code-reviewer',
    },
    {
      title: 'content-writer tokens above baseline',
      detail: 'Avg token usage is 23% above your team baseline. Shorter system prompts may reduce cost.',
      impact: 'medium',
      agent: 'content-writer',
    },
    {
      title: 'summarizer is your fastest and cheapest',
      detail: 'claude-3-haiku delivers sub-350ms latency at <$0.002/trace — consider expanding its use cases.',
      impact: 'low',
      agent: 'summarizer',
    },
  ];

  impactColor(impact: 'high' | 'medium' | 'low'): string {
    return { high: '#f87171', medium: '#facc15', low: '#4ade80' }[impact];
  }

  impactBg(impact: 'high' | 'medium' | 'low'): string {
    return {
      high: 'rgba(239,68,68,0.12)',
      medium: 'rgba(250,204,21,0.12)',
      low: 'rgba(34,197,94,0.12)',
    }[impact];
  }

  formatLatency(ms: number): string {
    return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
  }
}
