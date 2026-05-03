import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { Subscription, firstValueFrom } from 'rxjs';
import { TestRunsService } from '../../core/api/test-runs.service';
import { EventStreamService } from '../../core/api/event-stream.service';
import { TestRunDto, TestResultDto, TestRunStatus, Evaluation, TestResultArrivedEvent, RunCompleteEvent } from '../../core/api/models';

const AGENT_COLORS: Record<string, string> = {
  'Customer Support': '#8b5cf6', 'Code Helper': '#06b6d4',
  'Ticket Triage': '#10b981', 'Classifier': '#f59e0b',
};

@Component({
  selector: 'app-runs',
  templateUrl: './runs.html',
  styles: `:host { display: block; flex: 1; min-height: 0; overflow-y: auto; }`,
})
export class Runs implements OnInit, OnDestroy {
  readonly Math = Math;
  readonly TestRunStatus = TestRunStatus;
  readonly Evaluation = Evaluation;

  private readonly runsService = inject(TestRunsService);
  private readonly eventStreamService = inject(EventStreamService);

  readonly runs = signal<TestRunDto[]>([]);
  readonly loading = signal(true);
  readonly agentFilter = signal('All');
  readonly selectedRunId = signal<string | null>(null);
  readonly now = signal(Date.now());
  readonly deleteTargetId = signal<string | null>(null);
  readonly deleteInProgress = signal(false);
  readonly deleteError = signal<string | null>(null);

  private runStreams = new Map<string, Subscription>();
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  readonly agents = computed(() => {
    const names = [...new Set(this.runs().map(r => r.agentName))].sort();
    return ['All', ...names];
  });

  readonly visible = computed(() => {
    const af = this.agentFilter();
    const all = this.runs();
    return af === 'All' ? all : all.filter(r => r.agentName === af);
  });

  readonly selectedRun = computed(() => {
    const id = this.selectedRunId();
    const runs = this.visible();
    if (!id) return runs[0] ?? null;
    return runs.find(r => r.id === id) ?? runs[0] ?? null;
  });

  readonly avgPassRate = computed(() => {
    const completed = this.visible().filter(r => r.status === TestRunStatus.Completed);
    if (!completed.length) return 0;
    return Math.round(completed.reduce((s, r) => s + r.passRate, 0) / completed.length);
  });

  readonly hasPending = computed(() =>
    this.runs().some(r => r.status === TestRunStatus.Pending || r.status === TestRunStatus.Running));

  readonly deleteTarget = computed(() =>
    this.runs().find(r => r.id === this.deleteTargetId()) ?? null);

  async ngOnInit() {
    await this.loadRuns();
    this.startTimer();
  }

  ngOnDestroy() {
    this.stopPolling();
    for (const sub of this.runStreams.values()) sub.unsubscribe();
    this.runStreams.clear();
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  private async loadRuns() {
    try {
      const result = await firstValueFrom(this.runsService.getAll());
      this.runs.set(result.items);
      if (!this.selectedRunId() && result.items.length) {
        this.selectedRunId.set(result.items[0].id);
      }
    } catch {
      // keep existing data on error
    } finally {
      this.loading.set(false);
    }
    this.subscribeToActiveRuns();
    this.managePollState();
  }

  private subscribeToActiveRuns() {
    for (const run of this.runs()) {
      if (this.isActive(run) && !this.runStreams.has(run.id)) {
        const sub = this.eventStreamService.testRunStream(run.id).subscribe({
          next: (evt) => {
            if (evt.type === 'test-result-arrived') this.handleTestResult(evt);
            else if (evt.type === 'run-complete') this.handleRunComplete(evt);
          },
          error: () => this.runStreams.delete(run.id),
        });
        this.runStreams.set(run.id, sub);
      }
    }
  }

  private handleTestResult(evt: TestResultArrivedEvent) {
    const evaluation = this.scoreToEvaluation(evt.overallScore, evt.evaluations.length);
    this.runs.update(runs => runs.map(r => {
      if (r.id !== evt.runId) return r;
      const passed = r.passedCases + (evaluation === Evaluation.Pass ? 1 : 0);
      const failed = r.failedCases + (evaluation === Evaluation.Fail ? 1 : 0);
      const total = r.totalCases;
      return { ...r, passedCases: passed, failedCases: failed, passRate: total > 0 ? Math.round(passed / total * 100) : 0 };
    }));
  }

  private scoreToEvaluation(overallScore: string | null, evaluationCount: number): Evaluation {
    if (!overallScore || !evaluationCount) return Evaluation.Undecided;
    return ['Acceptable', 'Good', 'Excellent'].includes(overallScore) ? Evaluation.Pass : Evaluation.Fail;
  }

  resultEvaluation(result: TestResultDto): Evaluation {
    if (!result.evaluations.length) return Evaluation.Undecided;
    const passing = ['Acceptable', 'Good', 'Excellent'];
    return result.evaluations.every(s => passing.includes(s)) ? Evaluation.Pass : Evaluation.Fail;
  }

  private handleRunComplete(evt: RunCompleteEvent) {
    this.runStreams.get(evt.runId)?.unsubscribe();
    this.runStreams.delete(evt.runId);
    this.runsService.get(evt.runId).subscribe({
      next: (updated) => this.runs.update(runs => runs.map(r => r.id === evt.runId ? updated : r)),
    });
    if (!this.hasPending()) this.stopPolling();
  }

  private managePollState() {
    if (this.hasPending() && !this.pollInterval) {
      this.pollInterval = setInterval(() => this.loadRuns(), 5000);
    } else if (!this.hasPending() && this.pollInterval) {
      this.stopPolling();
    }
  }

  private stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private startTimer() {
    this.timerInterval = setInterval(() => {
      if (this.hasPending()) this.now.set(Date.now());
    }, 1000);
  }

  agentColor(agentName: string) { return AGENT_COLORS[agentName] ?? '#8b5cf6'; }

  passColor(rate: number | undefined) {
    if (rate === undefined) return 'var(--accent-primary)';
    return rate >= 75 ? 'var(--success)' : rate >= 55 ? 'var(--warn)' : 'var(--danger)';
  }

  statusLabel(status: TestRunStatus): string {
    switch (status) {
      case TestRunStatus.Pending: return 'Pending';
      case TestRunStatus.Running: return 'Running';
      case TestRunStatus.Completed: return 'Completed';
      case TestRunStatus.Failed: return 'Failed';
    }
  }

  statusColor(status: TestRunStatus): string {
    switch (status) {
      case TestRunStatus.Pending: return 'var(--text-muted)';
      case TestRunStatus.Running: return 'var(--accent-primary)';
      case TestRunStatus.Completed: return 'var(--success)';
      case TestRunStatus.Failed: return 'var(--danger)';
    }
  }

  isActive(run: TestRunDto) {
    return run.status === TestRunStatus.Pending || run.status === TestRunStatus.Running;
  }

  formatDuration(ms: number | null | undefined): string {
    if (!ms) return '—';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  formatElapsed(startedAt: string): string {
    const s = Math.floor((this.now() - new Date(startedAt).getTime()) / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}m ${rem}s`;
  }

  formatRelative(dateStr: string): string {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  passBarWidth(passed: number, total: number) {
    return total > 0 ? (passed / total) * 100 : 0;
  }

  formatLatency(ms: number) {
    return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
  }

  evalLabel(evaluation: Evaluation): string {
    return evaluation === Evaluation.Pass ? 'Pass' : evaluation === Evaluation.Fail ? 'Fail' : 'Undecided';
  }

  evalColor(evaluation: Evaluation): string {
    return evaluation === Evaluation.Pass ? 'var(--success)' : evaluation === Evaluation.Fail ? 'var(--danger)' : 'var(--warn)';
  }

  resultByCase(run: TestRunDto, testCaseId: string): TestResultDto | null {
    return run.results.find(r => r.testCaseId === testCaseId) ?? null;
  }

  progressPercent(run: TestRunDto): number {
    const total = run.totalCases;
    if (!total) return 0;
    const done = run.passedCases + run.failedCases;
    return Math.round((done / total) * 100);
  }

  openDeleteModal(id: string, event: Event) {
    event.stopPropagation();
    this.deleteTargetId.set(id);
    this.deleteInProgress.set(false);
    this.deleteError.set(null);
  }

  closeDeleteModal() { this.deleteTargetId.set(null); }

  async confirmDelete() {
    const target = this.deleteTarget();
    if (!target) return;
    this.deleteInProgress.set(true);
    this.deleteError.set(null);
    try {
      await firstValueFrom(this.runsService.delete(target.id));
      const remaining = this.runs().filter(r => r.id !== target.id);
      this.runs.set(remaining);
      if (this.selectedRunId() === target.id) {
        this.selectedRunId.set(remaining[0]?.id ?? null);
      }
      this.closeDeleteModal();
    } catch {
      this.deleteError.set('Failed to delete run. Please try again.');
      this.deleteInProgress.set(false);
    }
  }
}
