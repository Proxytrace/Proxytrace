import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { DatePipe, SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { from, concatMap, finalize } from 'rxjs';
import { TestSuitesService } from '../../core/api/test-suites.service';
import { TestRunsService } from '../../core/api/test-runs.service';
import { TestRunGroupsService } from '../../core/api/test-run-groups.service';
import { AgentsService } from '../../core/api/agents.service';
import { AgentCallsService } from '../../core/api/agent-calls.service';
import { ProvidersService, ModelEndpointDto } from '../../core/api/providers.service';
import { EvaluatorsService } from '../../core/api/evaluators.service';
import { AgentCallDto, AgentDto, EvaluatorDetailDto, EvaluatorKind, TestCaseDto, TestSuiteDto } from '../../core/api/models';
import { EVALUATOR_TYPE_META } from '../evaluators/evaluators';

interface RunState { passRate: number; runCount: number; lastRunId: string; }

// ─── Colors ──────────────────────────────────────────────────────────────────

const AGENT_PALETTE = ['#c9944a', '#6b9eaa', '#3daa6f', '#d4915c', '#d95555', '#a87ab5', '#5b82b0', '#d4915c'];

// ─── Create wizard steps ─────────────────────────────────────────────────────

type CreateStep = 1 | 2 | 3 | 4;

@Component({
  selector: 'app-suites',
  imports: [DatePipe, SlicePipe, FormsModule],
  templateUrl: './suites.html',
  styles: `:host { display: block; flex: 1; min-height: 0; overflow-y: auto; }`,
})
export class Suites implements OnInit {
  readonly Math = Math;
  private readonly suitesService = inject(TestSuitesService);
  private readonly testRunsService = inject(TestRunsService);
  private readonly testRunGroupsService = inject(TestRunGroupsService);
  private readonly agentsService = inject(AgentsService);
  private readonly agentCallsService = inject(AgentCallsService);
  private readonly providersService = inject(ProvidersService);
  private readonly evaluatorsService = inject(EvaluatorsService);
  private readonly router = inject(Router);

  // ── list state ─────────────────────────────────────────────────────────────
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly suites = signal<TestSuiteDto[]>([]);
  readonly agentFilter = signal('All');

  // ── run modal ──────────────────────────────────────────────────────────────
  readonly runTargetId = signal<string | null>(null);
  readonly runModalState = signal<'idle' | 'running' | 'error'>('idle');
  readonly runError = signal<string | null>(null);
  readonly runEndpoints = signal<ModelEndpointDto[]>([]);
  readonly runEndpointsLoading = signal(false);
  readonly runSelectedEndpointIds = signal<Set<string>>(new Set());
  readonly runEndpointSearch = signal('');
  private readonly runStateMap = signal<Record<string, RunState>>({});

  // ── delete modal ───────────────────────────────────────────────────────────
  readonly deleteTargetId = signal<string | null>(null);
  readonly deleteConfirmText = signal('');
  readonly deleteInProgress = signal(false);
  readonly deleteError = signal<string | null>(null);

  // ── edit modal ─────────────────────────────────────────────────────────────
  readonly editSuiteId = signal<string | null>(null);
  readonly editTab = signal<'traces' | 'evaluators'>('traces');
  // traces tab
  readonly editAllTraces = signal<AgentCallDto[]>([]);
  readonly editTracesLoading = signal(false);
  readonly editShowAddTraces = signal(false);
  readonly editAddTraceIds = signal<Set<string>>(new Set());
  readonly editAddInProgress = signal(false);
  readonly editAddError = signal<string | null>(null);
  readonly editRemovingIds = signal<Set<string>>(new Set());
  // evaluators tab
  readonly editAllEvaluators = signal<EvaluatorDetailDto[]>([]);
  readonly editEvaluatorsLoading = signal(false);
  readonly editSelectedEvaluatorIds = signal<Set<string>>(new Set());
  readonly editEvaluatorsSaving = signal(false);
  readonly editEvaluatorsError = signal<string | null>(null);

  // ── create wizard ──────────────────────────────────────────────────────────
  readonly createOpen = signal(false);
  readonly createStep = signal<CreateStep>(1);
  readonly createAgents = signal<AgentDto[]>([]);
  readonly createAgentsLoading = signal(false);
  readonly createSelectedAgentId = signal<string | null>(null);
  readonly createName = signal('');
  readonly createTraces = signal<AgentCallDto[]>([]);
  readonly createTracesLoading = signal(false);
  readonly createSelectedTraceIds = signal<Set<string>>(new Set());
  readonly createEvaluators = signal<EvaluatorDetailDto[]>([]);
  readonly createEvaluatorsLoading = signal(false);
  readonly createSelectedEvaluatorIds = signal<Set<string>>(new Set());
  readonly createInProgress = signal(false);
  readonly createError = signal<string | null>(null);

  // ── color cache ───────────────────────────────────────────────────────────
  private agentColorCache: Record<string, string> = {};

  // ── derived ───────────────────────────────────────────────────────────────

  readonly agentList = computed(() => ['All', ...new Set(this.suites().map(s => s.agentName))]);

  readonly visible = computed(() => {
    const af = this.agentFilter();
    const ss = this.suites();
    return af === 'All' ? ss : ss.filter(s => s.agentName === af);
  });

  readonly runTarget = computed(() => this.suites().find(s => s.id === this.runTargetId()) ?? null);

  readonly deleteTarget = computed(() => this.suites().find(s => s.id === this.deleteTargetId()) ?? null);

  readonly editTarget = computed(() => this.suites().find(s => s.id === this.editSuiteId()) ?? null);

  readonly editEvaluatorsDirty = computed(() => {
    const target = this.editTarget();
    if (!target) return false;
    const current = new Set(target.evaluators.map(e => e.id));
    const selected = this.editSelectedEvaluatorIds();
    if (current.size !== selected.size) return true;
    for (const id of selected) if (!current.has(id)) return true;
    return false;
  });

  readonly totalCases = computed(() => this.suites().reduce((n, s) => n + s.testCases.length, 0));

  readonly totalRuns = computed(() =>
    Object.values(this.runStateMap()).reduce((n, s) => n + s.runCount, 0));

  readonly avgPass = computed(() => {
    const rates = Object.values(this.runStateMap()).filter(s => s.runCount > 0).map(s => s.passRate);
    if (!rates.length) return null;
    return Math.round(rates.reduce((a, b) => a + b, 0) / rates.length);
  });

  readonly createSelectedAgent = computed(() =>
    this.createAgents().find(a => a.id === this.createSelectedAgentId()) ?? null);

  readonly createCanAdvanceStep1 = computed(() => !!this.createSelectedAgentId());
  readonly createCanAdvanceStep2 = computed(() => this.createName().trim().length > 0);
  readonly createCanAdvanceStep3 = computed(() => this.createSelectedTraceIds().size > 0);
  readonly createCanSubmit = computed(() => this.createCanAdvanceStep3());

  readonly runCanStart = computed(() =>
    this.runSelectedEndpointIds().size > 0 && !this.runEndpointsLoading());

  readonly runEndpointGroups = computed(() => {
    const q = this.runEndpointSearch().toLowerCase().trim();
    const filtered = q
      ? this.runEndpoints().filter(ep =>
          ep.modelName.toLowerCase().includes(q) || ep.providerName.toLowerCase().includes(q))
      : this.runEndpoints();
    const map = new Map<string, { providerId: string; providerName: string; endpoints: ModelEndpointDto[] }>();
    for (const ep of filtered) {
      if (!map.has(ep.providerId)) map.set(ep.providerId, { providerId: ep.providerId, providerName: ep.providerName, endpoints: [] });
      map.get(ep.providerId)!.endpoints.push(ep);
    }
    return [...map.values()];
  });

  readonly runProviderAllSelected = (providerId: string) => computed(() => {
    const group = this.runEndpointGroups().find(g => g.providerId === providerId);
    if (!group?.endpoints.length) return false;
    return group.endpoints.every(ep => this.runSelectedEndpointIds().has(ep.id));
  });

  toggleProvider(providerId: string) {
    const group = this.runEndpointGroups().find(g => g.providerId === providerId);
    if (!group) return;
    const allSelected = group.endpoints.every(ep => this.runSelectedEndpointIds().has(ep.id));
    this.runSelectedEndpointIds.update(s => {
      const next = new Set(s);
      if (allSelected) group.endpoints.forEach(ep => next.delete(ep.id));
      else group.endpoints.forEach(ep => next.add(ep.id));
      return next;
    });
  }

  ngOnInit() {
    this.loadSuites();
  }

  // ── load ──────────────────────────────────────────────────────────────────

  private loadSuites() {
    this.suitesService.getAll().subscribe({
      next: result => { this.suites.set(result.items); this.loading.set(false); },
      error: () => { this.error.set('Failed to load test suites.'); this.loading.set(false); },
    });
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  agentCount(agent: string): number {
    const ss = this.suites();
    return agent === 'All' ? ss.length : ss.filter(s => s.agentName === agent).length;
  }

  agentColor(agent: string): string {
    if (agent === 'All' || !agent) return AGENT_PALETTE[0];
    if (!this.agentColorCache[agent]) {
      let h = 0;
      for (const c of agent) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
      this.agentColorCache[agent] = AGENT_PALETTE[h % AGENT_PALETTE.length];
    }
    return this.agentColorCache[agent];
  }

  evaluatorMeta(kind: EvaluatorKind): { label: string; color: string; desc: string } {
    return EVALUATOR_TYPE_META[kind] ?? { label: kind, color: '#c9944a', desc: '' };
  }

  passRate(suite: TestSuiteDto): number | null {
    return this.runStateMap()[suite.id]?.passRate ?? null;
  }

  runCount(suite: TestSuiteDto): number {
    return this.runStateMap()[suite.id]?.runCount ?? 0;
  }

  lastRunId(suite: TestSuiteDto): string | null {
    return this.runStateMap()[suite.id]?.lastRunId ?? null;
  }

  passColor(rate: number | null): string {
    if (rate === null) return 'var(--text-muted)';
    return rate >= 75 ? 'var(--success)' : rate >= 55 ? 'var(--warn)' : 'var(--danger)';
  }

  shortId(id: string): string { return id.substring(0, 8); }

  testCasePreview(tc: TestCaseDto): string {
    const last = [...tc.input].reverse().find(m => m.role === 'user');
    return last?.content?.substring(0, 65) ?? '(no input)';
  }

  // ── run modal ─────────────────────────────────────────────────────────────

  openRunModal(suiteId: string) {
    this.runTargetId.set(suiteId);
    this.runModalState.set('idle');
    this.runError.set(null);
    this.runSelectedEndpointIds.set(new Set());
    this.runEndpointSearch.set('');
    this.runEndpoints.set([]);
    this.runEndpointsLoading.set(true);
    this.providersService.getAllModels().subscribe({
      next: endpoints => {
        this.runEndpoints.set(endpoints);
        if (endpoints.length === 1) this.runSelectedEndpointIds.set(new Set([endpoints[0].id]));
        this.runEndpointsLoading.set(false);
      },
      error: () => { this.runEndpointsLoading.set(false); },
    });
  }

  toggleEndpoint(id: string) {
    this.runSelectedEndpointIds.update(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  isEndpointSelected(id: string): boolean {
    return this.runSelectedEndpointIds().has(id);
  }

  closeRunModal() {
    this.runTargetId.set(null);
    this.runModalState.set('idle');
  }

  startRun() {
    const target = this.runTarget();
    const endpointIds = [...this.runSelectedEndpointIds()];
    if (!target || !endpointIds.length) return;
    this.runModalState.set('running');
    this.testRunGroupsService.create({ testSuiteId: target.id, modelEndpointIds: endpointIds }).subscribe({
      next: () => {
        this.closeRunModal();
        this.router.navigate(['/runs']);
      },
      error: err => {
        this.runError.set(err?.error ?? 'Run failed.');
        this.runModalState.set('error');
      },
    });
  }

  // ── delete modal ──────────────────────────────────────────────────────────

  openDeleteModal(suiteId: string) {
    this.deleteTargetId.set(suiteId);
    this.deleteConfirmText.set('');
    this.deleteInProgress.set(false);
    this.deleteError.set(null);
  }

  closeDeleteModal() {
    this.deleteTargetId.set(null);
  }

  readonly deleteNameMatches = computed(() => {
    const target = this.deleteTarget();
    return target ? this.deleteConfirmText().trim() === target.name : false;
  });

  confirmDelete() {
    const target = this.deleteTarget();
    if (!target || !this.deleteNameMatches()) return;
    this.deleteInProgress.set(true);
    this.suitesService.delete(target.id).subscribe({
      next: () => {
        this.suites.update(ss => ss.filter(s => s.id !== target.id));
        this.closeDeleteModal();
      },
      error: () => {
        this.deleteError.set('Delete failed. Please try again.');
        this.deleteInProgress.set(false);
      },
    });
  }

  // ── edit modal ────────────────────────────────────────────────────────────

  openEditModal(suiteId: string) {
    this.editSuiteId.set(suiteId);
    this.editTab.set('traces');
    this.editShowAddTraces.set(false);
    this.editAddTraceIds.set(new Set());
    this.editAddError.set(null);
    this.editAllTraces.set([]);
    this.editRemovingIds.set(new Set());
    this.editEvaluatorsError.set(null);
    this.editEvaluatorsSaving.set(false);

    this.editEvaluatorsLoading.set(true);
    this.evaluatorsService.getAll().subscribe({
      next: evs => {
        this.editAllEvaluators.set(evs);
        this.editEvaluatorsLoading.set(false);
        const suite = this.suites().find(s => s.id === suiteId);
        if (suite) this.editSelectedEvaluatorIds.set(new Set(suite.evaluators.map(e => e.id)));
      },
      error: () => this.editEvaluatorsLoading.set(false),
    });
  }

  closeEditModal() {
    this.editSuiteId.set(null);
  }

  openAddTraces() {
    this.editShowAddTraces.set(true);
    const suite = this.editTarget();
    if (!suite || this.editAllTraces().length) return;
    this.editTracesLoading.set(true);
    this.agentCallsService.getAll({ agentId: suite.agentId, pageSize: 50 }).subscribe({
      next: result => { this.editAllTraces.set(result.items); this.editTracesLoading.set(false); },
      error: () => this.editTracesLoading.set(false),
    });
  }

  toggleEditAddTrace(traceId: string) {
    this.editAddTraceIds.update(set => {
      const next = new Set(set);
      if (next.has(traceId)) next.delete(traceId); else next.add(traceId);
      return next;
    });
  }

  isEditAddTraceSelected(traceId: string): boolean {
    return this.editAddTraceIds().has(traceId);
  }

  addSelectedTraces() {
    const suiteId = this.editSuiteId();
    if (!suiteId) return;
    const ids = [...this.editAddTraceIds()];
    if (!ids.length) return;
    this.editAddInProgress.set(true);
    this.editAddError.set(null);

    from(ids).pipe(
      concatMap(traceId => this.suitesService.addTestCase(suiteId, traceId)),
      finalize(() => this.editAddInProgress.set(false)),
    ).subscribe({
      next: suite => this.suites.update(ss => ss.map(s => s.id === suiteId ? suite : s)),
      error: () => this.editAddError.set('Failed to add some traces. Please try again.'),
      complete: () => {
        this.editAddTraceIds.set(new Set());
        this.editShowAddTraces.set(false);
      },
    });
  }

  removeTestCase(suiteId: string, caseId: string) {
    this.editRemovingIds.update(s => new Set([...s, caseId]));
    this.suitesService.removeTestCase(suiteId, caseId).subscribe({
      next: suite => {
        this.suites.update(ss => ss.map(s => s.id === suiteId ? suite : s));
        this.editRemovingIds.update(s => { const n = new Set(s); n.delete(caseId); return n; });
      },
      error: () => this.editRemovingIds.update(s => { const n = new Set(s); n.delete(caseId); return n; }),
    });
  }

  isTestCaseRemoving(caseId: string): boolean {
    return this.editRemovingIds().has(caseId);
  }

  toggleEditEvaluator(evaluatorId: string) {
    this.editSelectedEvaluatorIds.update(set => {
      const next = new Set(set);
      if (next.has(evaluatorId)) next.delete(evaluatorId); else next.add(evaluatorId);
      return next;
    });
  }

  isEditEvaluatorSelected(evaluatorId: string): boolean {
    return this.editSelectedEvaluatorIds().has(evaluatorId);
  }

  saveEvaluators() {
    const suiteId = this.editSuiteId();
    if (!suiteId) return;
    this.editEvaluatorsSaving.set(true);
    this.editEvaluatorsError.set(null);
    this.suitesService.updateEvaluators(suiteId, [...this.editSelectedEvaluatorIds()]).subscribe({
      next: suite => {
        this.suites.update(ss => ss.map(s => s.id === suiteId ? suite : s));
        this.editEvaluatorsSaving.set(false);
      },
      error: () => {
        this.editEvaluatorsError.set('Failed to save evaluators. Please try again.');
        this.editEvaluatorsSaving.set(false);
      },
    });
  }

  // ── create wizard ─────────────────────────────────────────────────────────

  openCreateWizard() {
    this.createOpen.set(true);
    this.createStep.set(1);
    this.createSelectedAgentId.set(null);
    this.createName.set('');
    this.createSelectedTraceIds.set(new Set());
    this.createEvaluators.set([]);
    this.createSelectedEvaluatorIds.set(new Set());
    this.createInProgress.set(false);
    this.createError.set(null);

    this.createAgentsLoading.set(true);
    this.agentsService.getAll().subscribe({
      next: result => { this.createAgents.set(result.items); this.createAgentsLoading.set(false); },
      error: () => { this.createAgentsLoading.set(false); },
    });
  }

  closeCreateWizard() {
    this.createOpen.set(false);
  }

  selectCreateAgent(agentId: string) {
    this.createSelectedAgentId.set(agentId);
  }

  advanceCreate() {
    const step = this.createStep();
    if (step === 1 && this.createCanAdvanceStep1()) {
      this.createStep.set(2);
    } else if (step === 2 && this.createCanAdvanceStep2()) {
      this.createStep.set(3);
      this.loadTracesForCreate();
    } else if (step === 3 && this.createCanAdvanceStep3()) {
      this.createStep.set(4);
      this.loadEvaluatorsForCreate();
    }
  }

  backCreate() {
    const step = this.createStep();
    if (step > 1) this.createStep.set((step - 1) as CreateStep);
  }

  private loadTracesForCreate() {
    const agentId = this.createSelectedAgentId();
    if (!agentId) return;
    this.createTracesLoading.set(true);
    this.createSelectedTraceIds.set(new Set());
    this.agentCallsService.getAll({ agentId, pageSize: 50 }).subscribe({
      next: result => { this.createTraces.set(result.items); this.createTracesLoading.set(false); },
      error: () => { this.createTracesLoading.set(false); },
    });
  }

  private loadEvaluatorsForCreate() {
    this.createEvaluatorsLoading.set(true);
    this.evaluatorsService.getAll().subscribe({
      next: evs => { this.createEvaluators.set(evs); this.createEvaluatorsLoading.set(false); },
      error: () => { this.createEvaluatorsLoading.set(false); },
    });
  }

  toggleTrace(traceId: string) {
    this.createSelectedTraceIds.update(set => {
      const next = new Set(set);
      if (next.has(traceId)) next.delete(traceId); else next.add(traceId);
      return next;
    });
  }

  isTraceSelected(traceId: string): boolean {
    return this.createSelectedTraceIds().has(traceId);
  }

  toggleEvaluator(evaluatorId: string) {
    this.createSelectedEvaluatorIds.update(set => {
      const next = new Set(set);
      if (next.has(evaluatorId)) next.delete(evaluatorId); else next.add(evaluatorId);
      return next;
    });
  }

  isEvaluatorSelected(evaluatorId: string): boolean {
    return this.createSelectedEvaluatorIds().has(evaluatorId);
  }

  submitCreate() {
    const agentId = this.createSelectedAgentId();
    const name = this.createName().trim();
    const traceIds = [...this.createSelectedTraceIds()];
    if (!agentId || !name || !traceIds.length) return;

    this.createInProgress.set(true);
    this.createError.set(null);

    this.suitesService.create({
      name,
      agentId,
      evaluatorIds: [...this.createSelectedEvaluatorIds()],
      testCases: traceIds.map(id => ({ fromAgentCallId: id })),
    }).subscribe({
      next: suite => {
        this.suites.update(ss => [suite, ...ss]);
        this.closeCreateWizard();
      },
      error: err => {
        this.createError.set(err?.error ?? 'Failed to create suite.');
        this.createInProgress.set(false);
      },
    });
  }

  tracePreview(trace: AgentCallDto): string {
    const last = [...trace.request].reverse().find(m => m.role === 'user');
    return last?.content?.substring(0, 80) ?? `(${trace.model})`;
  }
}
