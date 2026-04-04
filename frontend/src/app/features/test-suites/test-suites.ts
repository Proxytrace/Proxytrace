import { Component, signal, computed } from '@angular/core';

interface TestSuite {
  id: string;
  name: string;
  description: string;
  agent: string;
  cases: number;
  passRate: number;
  lastRun: string;
  lastRunStatus: 'passed' | 'failed' | 'mixed';
}

@Component({
  selector: 'app-test-suites',
  imports: [],
  templateUrl: './test-suites.html',
  styles: ``,
})
export class TestSuites {
  readonly searchQuery = signal('');

  readonly allSuites: TestSuite[] = [
    {
      id: 'suite_001',
      name: 'Customer Support – Core',
      description: 'Core question-answering, empathy, and escalation routing scenarios.',
      agent: 'customer-support-v2',
      cases: 24,
      passRate: 92,
      lastRun: '1 hr ago',
      lastRunStatus: 'passed',
    },
    {
      id: 'suite_002',
      name: 'Content Quality',
      description: 'Checks for length targets, tone consistency, and factual accuracy.',
      agent: 'content-writer',
      cases: 18,
      passRate: 78,
      lastRun: '3 hrs ago',
      lastRunStatus: 'mixed',
    },
    {
      id: 'suite_003',
      name: 'Code Review Accuracy',
      description: 'Bug detection rate, false positive count, and suggestion quality rubric.',
      agent: 'code-reviewer',
      cases: 31,
      passRate: 85,
      lastRun: '1 day ago',
      lastRunStatus: 'passed',
    },
  ];

  readonly filtered = computed(() => {
    const q = this.searchQuery().toLowerCase();
    if (!q) return this.allSuites;
    return this.allSuites.filter(
      (s) => s.name.toLowerCase().includes(q) || s.agent.includes(q) || s.description.toLowerCase().includes(q)
    );
  });

  onSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  passRateColor(rate: number): string {
    if (rate >= 90) return '#4ade80';
    if (rate >= 75) return '#facc15';
    return '#f87171';
  }
}
