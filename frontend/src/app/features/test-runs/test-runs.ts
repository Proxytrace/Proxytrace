import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface TestRun {
  id: string;
  suite: string;
  passed: number;
  failed: number;
  total: number;
  duration: string;
  timestamp: string;
  status: 'completed' | 'running' | 'failed';
}

@Component({
  selector: 'app-test-runs',
  imports: [RouterLink],
  templateUrl: './test-runs.html',
  styles: ``,
})
export class TestRuns {
  readonly runs: TestRun[] = [
    { id: 'run_abc123', suite: 'Customer Support – Core', passed: 22, failed: 2, total: 24, duration: '1m 42s', timestamp: '1 hr ago', status: 'completed' },
    { id: 'run_def456', suite: 'Content Quality', passed: 14, failed: 4, total: 18, duration: '58s', timestamp: '3 hrs ago', status: 'completed' },
    { id: 'run_ghi789', suite: 'Code Review Accuracy', passed: 26, failed: 5, total: 31, duration: '3m 12s', timestamp: '1 day ago', status: 'completed' },
    { id: 'run_jkl012', suite: 'Customer Support – Core', passed: 21, failed: 3, total: 24, duration: '1m 38s', timestamp: '2 days ago', status: 'completed' },
    { id: 'run_mno345', suite: 'Content Quality', passed: 15, failed: 3, total: 18, duration: '1m 2s', timestamp: '3 days ago', status: 'completed' },
  ];

  passRate(run: TestRun): number {
    return Math.round((run.passed / run.total) * 100);
  }

  passRateColor(rate: number): string {
    if (rate >= 90) return '#4ade80';
    if (rate >= 75) return '#facc15';
    return '#f87171';
  }
}
