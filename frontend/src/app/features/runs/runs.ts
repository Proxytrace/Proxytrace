import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { Subscription, firstValueFrom } from 'rxjs';
import { TestRunGroupsService } from '../../core/api/test-run-groups.service';
import { EventStreamService } from '../../core/api/event-stream.service';
import {
  TestRunGroupDto, TestRunDto, TestResultDto, TestRunStatus, Evaluation,
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

  private readonly groupsService = inject(TestRunGroupsService);
  private readonly eventStreamService = inject(EventStreamService);

  readonly groups = signal<TestRunGroupDto[]>([]);
  readonly loading = signal(true);
  readonly agentFilter = signal('All');
  readonly selectedGroupId = signal<string | null>(null);
  readonly selectedRunId = signal<string | null>(null);
  readonly now = signal(Date.now());
  readonly deleteTargetId = signal<string | null>(null);
  readonly deleteInProgress = signal(false);
  readonly deleteError = signal<string | null>(null);
  readonly rerunInProgress = signal(false);
  readonly cancelInProgress = signal(false);
  // key: `${runId}:${caseId}`
  readonly expandedCaseIds = signal<Set<string>>(new Set());
  readonly caseProgress = signal<Map<string, CaseProgress>>(new Map());

  private groupStreams = new Map<string, Subscription>();
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  readonly agents = computed(() => {
    const names = [...new Set(this.groups().map(g => g.agentName))].sort();
    return ['All', ...names];
  });

  readonly visible = computed(() => {
    const af = this.agentFilter();
    return af === 'All' ? this.groups() : this.groups().filter(g => g.agentName === af);
  });

  readonly selectedGroup = computed(() => {
    const id = this.selectedGroupId();
    const all = this.visible();
    return id ? (all.find(g => g.id === id) ?? all[0] ?? null) : (all[0] ?? null);
  });

  readonly selectedRun = computed(() => {
    const group = this.selectedGroup();
    if (!group?.runs?.length) return null;
    const id = this.selectedRunId();
    if (id) {
      const match = group.runs.find(r => r.id === id);
      if (match) return match;
    }
    return group.runs[0];
  });

  readonly hasPending = computed(() =>
    this.groups().some(g => this.isGroupActive(g)));

  readonly deleteTarget = computed(() =>
    this.groups().find(g => g.id === this.deleteTargetId()) ?? null);

  readonly avgPassRate = computed(() => {
    const completed = this.visible().filter(g => g.status === TestRunStatus.Completed);
    if (!completed.length) return 0;
    const allRuns = completed.flatMap(g => g.runs).filter(r => r.status === TestRunStatus.Completed);
    if (!allRuns.length) return 0;
    return Math.round(allRuns.reduce((s, r) => s + r.passRate, 0) / allRuns.length);
  });

  async ngOnInit() {
    await this.loadGroups();
    this.startTimer();
  }

  ngOnDestroy() {
    this.stopPolling();
    for (const sub of this.groupStreams.values()) sub.unsubscribe();
    this.groupStreams.clear();
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  private async loadGroups() {
    try {
      const result = await firstValueFrom(this.groupsService.getAll());
      this.groups.set(result.items);
      if (!this.selectedGroupId() && result.items.length) {
        this.selectedGroupId.set(result.items[0].id);
        this.selectedRunId.set(result.items[0].runs[0]?.id ?? null);
      }
    } catch {
      // keep existing data on error
    } finally {
      this.loading.set(false);
    }
    this.subscribeToActiveGroups();
    this.managePollState();
  }

  private subscribeToActiveGroups() {
    for (const group of this.groups()) {
      if (this.isGroupActive(group) && !this.groupStreams.has(group.id)) {
        const sub = this.eventStreamService.testRunGroupStream(group.id).subscribe({
          next: (evt) => {
            if (evt.type === 'test-case-started') {
              const key = `${evt.runId}:${evt.testCaseId}`;
              this.caseProgress.update(m => new Map(m).set(key, { phase: 'inference', completedSteps: 0, startedAt: Date.now() }));
            } else if (evt.type === 'inference-done') {
              const key = `${evt.runId}:${evt.testCaseId}`;
              this.caseProgress.update(m => {
                const next = new Map(m);
                const p = next.get(key);
                next.set(key, { phase: 'evaluating', completedSteps: 1, startedAt: p?.startedAt ?? Date.now() });
                return next;
              });
            } else if (evt.type === 'evaluation-arrived') {
              const key = `${evt.runId}:${evt.testCaseId}`;
              this.caseProgress.update(m => {
                const next = new Map(m);
                const p = next.get(key);
                next.set(key, { phase: 'evaluating', completedSteps: (p?.completedSteps ?? 1) + 1, startedAt: p?.startedAt ?? Date.now() });
                return next;
              });
            } else if (evt.type === 'test-result-arrived') {
              const newResult: TestResultDto = {
                id: '', testCaseId: evt.testCaseId, testCaseSummary: '', actualResponse: '',
                evaluations: evt.evaluations, durationMs: evt.durationMs,
              };
              this.groups.update(groups => groups.map(g =>
                g.id !== evt.groupId ? g : {
                  ...g, runs: g.runs.map(r => r.id !== evt.runId ? r : { ...r, results: [...r.results, newResult] }),
                }
              ));
            } else if (evt.type === 'run-complete') {
              this.groupsService.get(evt.groupId).subscribe({
                next: (updated) => this.groups.update(groups => groups.map(g => g.id === evt.groupId ? updated : g)),
              });
            } else if (evt.type === 'group-run-complete') {
              this.groupStreams.get(group.id)?.unsubscribe();
              this.groupStreams.delete(group.id);
              this.groupsService.get(group.id).subscribe({
                next: (updated) => this.groups.update(groups => groups.map(g => g.id === group.id ? updated : g)),
              });
              if (!this.hasPending()) this.stopPolling();
            }
          },
          error: () => this.groupStreams.delete(group.id),
        });
        this.groupStreams.set(group.id, sub);
      }
    }
  }

  private managePollState() {
    if (this.hasPending() && !this.pollInterval) {
      this.pollInterval = setInterval(() => this.loadGroups(), 5000);
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

  selectGroup(group: TestRunGroupDto) {
    this.selectedGroupId.set(group.id);
    const currentRunId = this.selectedRunId();
    if (!group.runs.some(r => r.id === currentRunId)) {
      this.selectedRunId.set(group.runs[0]?.id ?? null);
    }
  }

  isGroupActive(group: TestRunGroupDto): boolean {
    return group.status === TestRunStatus.Pending || group.status === TestRunStatus.Running;
  }

  isRunActive(run: TestRunDto): boolean {
    return run.status === TestRunStatus.Pending || run.status === TestRunStatus.Running;
  }

  groupPassRate(group: TestRunGroupDto): number {
    const completed = group.runs.filter(r => r.status === TestRunStatus.Completed);
    if (!completed.length) return 0;
    return Math.round(completed.reduce((s, r) => s + r.passRate, 0) / completed.length);
  }

  groupProgressPercent(group: TestRunGroupDto): number {
    const done = group.runs.reduce((s, r) => s + r.results.length, 0);
    const total = group.runs.reduce((s, r) => s + r.testCases.length, 0);
    return total > 0 ? Math.round(done / total * 100) : 0;
  }

  groupCompletedRuns(group: TestRunGroupDto): number {
    return group.runs.filter(r => !this.isRunActive(r)).length;
  }

  groupDurationMs(group: TestRunGroupDto): number | null {
    if (!group.completedAt) return null;
    return new Date(group.completedAt).getTime() - new Date(group.createdAt).getTime();
  }

  caseProgressSteps(run: TestRunDto, testCaseId: string): StepStatus[] {
    const total = run.evaluators.length + 1;
    const steps = new Array<StepStatus>(total).fill('pending');
    const p = this.caseProgress().get(`${run.id}:${testCaseId}`);
    if (!p) return steps;
    if (p.phase === 'inference') { steps[0] = 'active'; return steps; }
    const done = p.completedSteps;
    for (let i = 0; i < Math.min(done, total); i++) steps[i] = 'done';
    if (done < total) steps[done] = 'active';
    return steps;
  }

  caseProgressAction(run: TestRunDto, testCaseId: string): string {
    const p = this.caseProgress().get(`${run.id}:${testCaseId}`);
    if (!p) return 'Waiting';
    if (p.phase === 'inference') return 'Inference';
    const idx = p.completedSteps - 1;
    return idx < run.evaluators.length ? run.evaluators[idx].name : 'Done';
  }

  caseElapsed(run: TestRunDto, testCaseId: string): string {
    const p = this.caseProgress().get(`${run.id}:${testCaseId}`);
    if (!p) return '—';
    return this.formatLatency(this.now() - p.startedAt);
  }

  hasCaseStarted(run: TestRunDto, testCaseId: string): boolean {
    return this.caseProgress().has(`${run.id}:${testCaseId}`);
  }

  toggleCase(run: TestRunDto, caseId: string) {
    const key = `${run.id}:${caseId}`;
    this.expandedCaseIds.update(set => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  isCaseExpanded(run: TestRunDto, caseId: string): boolean {
    return this.expandedCaseIds().has(`${run.id}:${caseId}`);
  }

  resultByCase(run: TestRunDto, testCaseId: string): TestResultDto | null {
    return run.results.find(r => r.testCaseId === testCaseId) ?? null;
  }

  progressPercent(run: TestRunDto): number {
    const total = run.testCases.length;
    return total ? Math.round(run.results.length / total * 100) : 0;
  }

  resultEvaluation(result: TestResultDto): Evaluation {
    if (!result.evaluations.length) return Evaluation.Undecided;
    const passing = ['Acceptable', 'Good', 'Excellent'];
    return result.evaluations.every(e => passing.includes(e.score)) ? Evaluation.Pass : Evaluation.Fail;
  }

  async cancelGroup(group: TestRunGroupDto) {
    if (!this.isGroupActive(group) || this.cancelInProgress()) return;
    this.cancelInProgress.set(true);
    try {
      await firstValueFrom(this.groupsService.cancel(group.id));
      this.groupStreams.get(group.id)?.unsubscribe();
      this.groupStreams.delete(group.id);
      this.groups.update(groups => groups.map(g =>
        g.id === group.id ? { ...g, status: TestRunStatus.Cancelled } : g
      ));
      if (!this.hasPending()) this.stopPolling();
    } catch { /* no-op */ } finally {
      this.cancelInProgress.set(false);
    }
  }

  async rerunGroup(group: TestRunGroupDto) {
    if (this.rerunInProgress()) return;
    this.rerunInProgress.set(true);
    try {
      const newGroup = await firstValueFrom(this.groupsService.create({
        testSuiteId: group.suiteId,
        modelEndpointIds: group.runs.map(r => r.endpointId),
      }));
      this.groups.update(groups => [newGroup, ...groups]);
      this.selectedGroupId.set(newGroup.id);
      this.selectedRunId.set(newGroup.runs[0]?.id ?? null);
      this.subscribeToActiveGroups();
      this.managePollState();
    } catch { /* no-op */ } finally {
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
      await firstValueFrom(this.groupsService.delete(target.id));
      const remaining = this.groups().filter(g => g.id !== target.id);
      this.groups.set(remaining);
      if (this.selectedGroupId() === target.id) {
        this.selectedGroupId.set(remaining[0]?.id ?? null);
        this.selectedRunId.set(remaining[0]?.runs[0]?.id ?? null);
      }
      this.closeDeleteModal();
    } catch {
      this.deleteError.set('Failed to delete run group. Please try again.');
      this.deleteInProgress.set(false);
    }
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

  evaluatorKindColor(kind: string): string { return EVALUATOR_KIND_COLORS[kind] ?? '#c9944a'; }
  agentColor(agentName: string): string { return AGENT_COLORS[agentName] ?? '#c9944a'; }

  passColor(rate: number | undefined): string {
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

  formatDuration(ms: number | null | undefined): string {
    if (!ms) return '—';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  formatElapsed(dateStr: string): string {
    const s = Math.floor((this.now() - new Date(dateStr).getTime()) / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    return `${m}m ${s % 60}s`;
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
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  passBarWidth(passed: number, total: number): number {
    return total > 0 ? (passed / total) * 100 : 0;
  }

  formatLatency(ms: number): string {
    return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
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
}
