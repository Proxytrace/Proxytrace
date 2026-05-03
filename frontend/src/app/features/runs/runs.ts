import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { Subscription, firstValueFrom } from 'rxjs';
import { TestRunsService } from '../../core/api/test-runs.service';
import { EventStreamService } from '../../core/api/event-stream.service';
import {
  TestRunDto, TestResultDto, TestRunStatus, Evaluation,
  TestCaseStartedEvent, InferenceDoneEvent, EvaluationArrivedEvent,
  TestResultArrivedEvent, RunCompleteEvent, EvaluationResultDto,
} from '../../core/api/models';

const AGENT_COLORS: Record<string, string> = {
  'Customer Support': '#c9944a', 'Code Helper': '#6b9eaa',
  'Ticket Triage': '#3daa6f', 'Classifier': '#d4915c',
};

const EVALUATOR_KIND_COLORS: Record<string, string> = {
  Custom: '#c9944a', ExactMatch: '#6b9eaa', NumericMatch: '#8dbecb',
  Helpfulness: '#c9944a', Politeness: '#c9944a', JsonSchemaMatch: '#6b9eaa',
  Safety: '#d95555', ToolUsage: '#3daa6f',
};

interface CaseProgress {
  phase: 'inference' | 'evaluating';
  completedSteps: number;
  startedAt: number;
}

export type StepStatus = 'done' | 'active' | 'pending';

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
  readonly rerunInProgress = signal(false);
  readonly cancelInProgress = signal(false);
  readonly expandedCaseIds = signal<Set<string>>(new Set());
  readonly caseProgress = signal<Map<string, CaseProgress>>(new Map());

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
            if (evt.type === 'test-case-started') this.handleTestCaseStarted(evt);
            else if (evt.type === 'inference-done') this.handleInferenceDone(evt);
            else if (evt.type === 'evaluation-arrived') this.handleEvaluationArrived(evt);
            else if (evt.type === 'test-result-arrived') this.handleTestResult(evt);
            else if (evt.type === 'run-complete') this.handleRunComplete(evt);
          },
          error: () => this.runStreams.delete(run.id),
        });
        this.runStreams.set(run.id, sub);
      }
    }
  }

  private handleTestCaseStarted(evt: TestCaseStartedEvent) {
    this.caseProgress.update(m => new Map(m).set(evt.testCaseId, { phase: 'inference', completedSteps: 0, startedAt: Date.now() }));
  }

  private handleInferenceDone(evt: InferenceDoneEvent) {
    this.caseProgress.update(m => {
      const next = new Map(m);
      const p = next.get(evt.testCaseId);
      next.set(evt.testCaseId, { phase: 'evaluating', completedSteps: 1, startedAt: p?.startedAt ?? Date.now() });
      return next;
    });
  }

  private handleEvaluationArrived(evt: EvaluationArrivedEvent) {
    this.caseProgress.update(m => {
      const next = new Map(m);
      const p = next.get(evt.testCaseId);
      next.set(evt.testCaseId, { phase: 'evaluating', completedSteps: (p?.completedSteps ?? 1) + 1, startedAt: p?.startedAt ?? Date.now() });
      return next;
    });
  }

  private handleTestResult(evt: TestResultArrivedEvent) {
    const newResult: TestResultDto = {
      id: '', testCaseId: evt.testCaseId, testCaseSummary: '', actualResponse: '',
      evaluations: evt.evaluations, durationMs: evt.durationMs,
    };
    this.runs.update(runs => runs.map(r =>
      r.id !== evt.runId ? r : { ...r, results: [...r.results, newResult] }
    ));
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

  // Progress bar: returns one entry per step (inference + each evaluator)
  caseProgressSteps(run: TestRunDto, testCaseId: string): StepStatus[] {
    const total = run.evaluators.length + 1;
    const steps = new Array<StepStatus>(total).fill('pending');
    const p = this.caseProgress().get(testCaseId);
    if (!p) return steps;

    if (p.phase === 'inference') {
      steps[0] = 'active';
      return steps;
    }

    const done = p.completedSteps; // 1 after inference, +1 per evaluator
    for (let i = 0; i < Math.min(done, total); i++) steps[i] = 'done';
    if (done < total) steps[done] = 'active';
    return steps;
  }

  // Label for the step currently in progress
  caseProgressAction(run: TestRunDto, testCaseId: string): string {
    const p = this.caseProgress().get(testCaseId);
    if (!p) return 'Waiting';
    if (p.phase === 'inference') return 'Inference';
    // completedSteps=1 → evaluators[0] is running
    const idx = p.completedSteps - 1;
    return idx < run.evaluators.length ? run.evaluators[idx].name : 'Done';
  }

  toggleCase(id: string) {
    this.expandedCaseIds.update(set => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  isCaseExpanded(id: string): boolean {
    return this.expandedCaseIds().has(id);
  }

  resultEvaluation(result: TestResultDto): Evaluation {
    if (!result.evaluations.length) return Evaluation.Undecided;
    const passing = ['Acceptable', 'Good', 'Excellent'];
    return result.evaluations.every(e => passing.includes(e.score)) ? Evaluation.Pass : Evaluation.Fail;
  }

  scoreColor(score: string): string {
    switch (score) {
      case 'Excellent': case 'Good': return 'var(--success)';
      case 'Acceptable': return 'var(--warn)';
      case 'Bad': case 'Terrible': return 'var(--danger)';
      default: return 'var(--text-muted)';
    }
  }

  scoreBg(score: string): string {
    switch (score) {
      case 'Excellent': case 'Good': return 'var(--success-subtle)';
      case 'Acceptable': return 'var(--warn-subtle)';
      case 'Bad': case 'Terrible': return 'var(--danger-subtle)';
      default: return 'var(--bg-card-2)';
    }
  }

  evaluatorKindColor(kind: string): string {
    return EVALUATOR_KIND_COLORS[kind] ?? '#c9944a';
  }

  agentColor(agentName: string) { return AGENT_COLORS[agentName] ?? '#c9944a'; }

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
      case TestRunStatus.Cancelled: return 'Cancelled';
    }
  }

  statusColor(status: TestRunStatus): string {
    switch (status) {
      case TestRunStatus.Pending: return 'var(--text-muted)';
      case TestRunStatus.Running: return 'var(--accent-primary)';
      case TestRunStatus.Completed: return 'var(--success)';
      case TestRunStatus.Failed: return 'var(--danger)';
      case TestRunStatus.Cancelled: return 'var(--warn)';
    }
  }

  statusBg(status: TestRunStatus): string {
    switch (status) {
      case TestRunStatus.Pending:   return 'var(--bg-card-2)';
      case TestRunStatus.Running:   return 'var(--accent-subtle)';
      case TestRunStatus.Completed: return 'var(--success-subtle)';
      case TestRunStatus.Failed:    return 'var(--danger-subtle)';
      case TestRunStatus.Cancelled: return 'var(--warn-subtle)';
    }
  }

  isActive(run: TestRunDto) {
    return run.status === TestRunStatus.Pending || run.status === TestRunStatus.Running;
  }

  async cancelRun(run: TestRunDto) {
    if (!this.isActive(run) || this.cancelInProgress()) return;
    this.cancelInProgress.set(true);
    try {
      await firstValueFrom(this.runsService.cancel(run.id));
      this.runStreams.get(run.id)?.unsubscribe();
      this.runStreams.delete(run.id);
      this.runs.update(runs => runs.map(r =>
        r.id === run.id ? { ...r, status: TestRunStatus.Cancelled } : r
      ));
      if (!this.hasPending()) this.stopPolling();
    } catch {
      // no-op
    } finally {
      this.cancelInProgress.set(false);
    }
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

  caseElapsed(testCaseId: string): string {
    const p = this.caseProgress().get(testCaseId);
    if (!p) return '—';
    return this.formatLatency(this.now() - p.startedAt);
  }

  evalLabel(evaluation: Evaluation): string {
    return evaluation === Evaluation.Pass ? 'Pass' : evaluation === Evaluation.Fail ? 'Fail' : 'Undecided';
  }

  evalColor(evaluation: Evaluation): string {
    return evaluation === Evaluation.Pass ? 'var(--success)' : evaluation === Evaluation.Fail ? 'var(--danger)' : 'var(--warn)';
  }

  evalBg(evaluation: Evaluation): string {
    return evaluation === Evaluation.Pass ? 'var(--success-subtle)' : evaluation === Evaluation.Fail ? 'var(--danger-subtle)' : 'var(--warn-subtle)';
  }

  resultByCase(run: TestRunDto, testCaseId: string): TestResultDto | null {
    return run.results.find(r => r.testCaseId === testCaseId) ?? null;
  }

  progressPercent(run: TestRunDto): number {
    const total = run.testCases.length;
    if (!total) return 0;
    return Math.round((run.results.length / total) * 100);
  }

  async rerunRun(run: TestRunDto) {
    if (!run.suiteId || this.rerunInProgress()) return;
    this.rerunInProgress.set(true);
    try {
      const newRun = await firstValueFrom(this.runsService.create({
        testSuiteId: run.suiteId,
        modelEndpointId: run.endpointId,
      }));
      this.runs.update(runs => [newRun, ...runs]);
      this.selectedRunId.set(newRun.id);
      this.subscribeToActiveRuns();
      this.managePollState();
    } catch {
      // no-op: button returns to ready state
    } finally {
      this.rerunInProgress.set(false);
    }
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
