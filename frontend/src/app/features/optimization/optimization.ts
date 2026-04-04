import { Component } from '@angular/core';

interface Experiment {
  id: string;
  name: string;
  description: string;
  agent: string;
  variants: number;
  status: 'running' | 'completed' | 'draft';
  winner: string | null;
  improvement: number | null;
  createdAt: string;
}

interface PromptTip {
  title: string;
  detail: string;
  impact: 'high' | 'medium' | 'low';
  agent: string;
}

@Component({
  selector: 'app-optimization',
  imports: [],
  templateUrl: './optimization.html',
  styles: ``,
})
export class Optimization {
  readonly experiments: Experiment[] = [
    {
      id: 'exp_001',
      name: 'System prompt length vs quality',
      description: 'Tests three system prompt lengths on response quality rubric.',
      agent: 'customer-support-v2',
      variants: 3,
      status: 'completed',
      winner: 'Variant B – concise prompt',
      improvement: 8.3,
      createdAt: '2 days ago',
    },
    {
      id: 'exp_002',
      name: 'Chain-of-thought vs direct answer',
      description: 'Compares CoT framing to direct-answer framing for code review tasks.',
      agent: 'code-reviewer',
      variants: 2,
      status: 'running',
      winner: null,
      improvement: null,
      createdAt: '4 hrs ago',
    },
    {
      id: 'exp_003',
      name: 'Temperature sweep — summarizer',
      description: 'Sweeps temperature 0.2 → 0.8 to find the optimal creativity/accuracy trade-off.',
      agent: 'summarizer',
      variants: 4,
      status: 'draft',
      winner: null,
      improvement: null,
      createdAt: '1 day ago',
    },
  ];

  readonly tips: PromptTip[] = [
    {
      title: 'High error rate on code-reviewer',
      detail: '4.5% error rate detected — consider adding retry logic or tightening the output format instructions.',
      impact: 'high',
      agent: 'code-reviewer',
    },
    {
      title: 'content-writer tokens above baseline',
      detail: 'Avg token usage is 23% above your team baseline. Shorter system prompts may reduce cost without quality loss.',
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
}
