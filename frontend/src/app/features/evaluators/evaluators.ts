import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { DatePipe, SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EvaluatorsService } from '../../core/api/evaluators.service';
import { ProvidersService, ModelEndpointDto } from '../../core/api/providers.service';
import { CreateEvaluatorPayload, EvaluatorDetailDto, EvaluatorKind } from '../../core/api/models';

// ─── Evaluator kind metadata ─────────────────────────────────────────────────

export interface EvaluatorTypeMeta {
  label: string;
  short: string;
  color: string;
  icon: string;
  desc: string;
  group: string;
  requiresEndpoint: boolean;
}

export const EVALUATOR_TYPE_META: Record<EvaluatorKind, EvaluatorTypeMeta> = {
  [EvaluatorKind.Custom]: {
    label: 'Custom LLM Judge',
    short: 'LLM judge',
    color: '#c9944a',
    icon: 'beaker',
    desc: 'A grader model scores responses against a custom rubric prompt you define.',
    group: 'llm',
    requiresEndpoint: true,
  },
  [EvaluatorKind.Helpfulness]: {
    label: 'Helpfulness',
    short: 'LLM judge',
    color: '#c9944a',
    icon: 'beaker',
    desc: 'Preset LLM judge that rates responses for helpfulness on a 1–5 scale.',
    group: 'llm',
    requiresEndpoint: true,
  },
  [EvaluatorKind.Politeness]: {
    label: 'Politeness',
    short: 'LLM judge',
    color: '#c9944a',
    icon: 'beaker',
    desc: 'Preset LLM judge that rates responses for politeness and tone.',
    group: 'llm',
    requiresEndpoint: true,
  },
  [EvaluatorKind.Safety]: {
    label: 'Safety Classifier',
    short: 'Classifier',
    color: '#d95555',
    icon: 'shield',
    desc: 'Preset LLM classifier that checks for harmful, unsafe, or policy-violating content.',
    group: 'llm',
    requiresEndpoint: true,
  },
  [EvaluatorKind.ExactMatch]: {
    label: 'Exact Match',
    short: 'Rule',
    color: '#6b9eaa',
    icon: 'filter',
    desc: 'Passes when the agent response exactly matches the expected output.',
    group: 'rule',
    requiresEndpoint: false,
  },
  [EvaluatorKind.JsonSchemaMatch]: {
    label: 'JSON Schema Match',
    short: 'Rule',
    color: '#6b9eaa',
    icon: 'filter',
    desc: 'Validates the agent response against a JSON Schema definition.',
    group: 'rule',
    requiresEndpoint: false,
  },
  [EvaluatorKind.NumericMatch]: {
    label: 'Numeric Match',
    short: 'Numeric',
    color: '#8dbecb',
    icon: 'hash',
    desc: 'Extract a number from the response and check it within a tolerance.',
    group: 'numeric',
    requiresEndpoint: false,
  },
  [EvaluatorKind.ToolUsage]: {
    label: 'Tool Usage',
    short: 'Tool',
    color: '#3daa6f',
    icon: 'tool',
    desc: 'Preset LLM judge that checks whether the agent made the correct tool calls.',
    group: 'llm',
    requiresEndpoint: true,
  },
};

// Ordered list for the "New Evaluator" type picker
export const EVALUATOR_KIND_ORDER: EvaluatorKind[] = [
  EvaluatorKind.Custom,
  EvaluatorKind.ExactMatch,
  EvaluatorKind.NumericMatch,
  EvaluatorKind.Helpfulness,
  EvaluatorKind.Politeness,
  EvaluatorKind.JsonSchemaMatch,
  EvaluatorKind.Safety,
  EvaluatorKind.ToolUsage,
];

export type TypeFilter = 'all' | 'llm' | 'rule' | 'numeric';

export interface TypeFilterTab {
  key: TypeFilter;
  label: string;
}

@Component({
  selector: 'app-evaluators',
  imports: [DatePipe, SlicePipe, FormsModule],
  templateUrl: './evaluators.html',
  styles: `:host { display: block; flex: 1; min-height: 0; overflow-y: auto; }`,
})
export class Evaluators implements OnInit {
  readonly EvaluatorKind = EvaluatorKind;
  readonly EVALUATOR_TYPE_META = EVALUATOR_TYPE_META;
  readonly EVALUATOR_KIND_ORDER = EVALUATOR_KIND_ORDER;
  readonly Math = Math;
  readonly typeFilterTabs: TypeFilterTab[] = [
    { key: 'all', label: 'All types' },
    { key: 'llm', label: 'LLM judge' },
    { key: 'rule', label: 'Rule' },
    { key: 'numeric', label: 'Numeric' },
  ];

  private readonly evaluatorsService = inject(EvaluatorsService);
  private readonly providersService = inject(ProvidersService);

  // ── list state ─────────────────────────────────────────────────────────────
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly evaluators = signal<EvaluatorDetailDto[]>([]);
  readonly typeFilter = signal<TypeFilter>('all');
  readonly selectedId = signal<string | null>(null);

  // ── delete state ───────────────────────────────────────────────────────────
  readonly deleteTargetId = signal<string | null>(null);
  readonly deleteInProgress = signal(false);
  readonly deleteError = signal<string | null>(null);

  // ── edit modal state ───────────────────────────────────────────────────────
  readonly editOpen = signal(false);
  readonly editTargetId = signal<string | null>(null);
  readonly editName = signal('');
  readonly editSystemMessage = signal('');
  readonly editEndpointId = signal<string | null>(null);
  readonly editJsonSchema = signal('');
  readonly editExtractionPattern = signal('');
  readonly editTolerance = signal('0.01');
  readonly editInProgress = signal(false);
  readonly editError = signal<string | null>(null);

  // ── create modal state ─────────────────────────────────────────────────────
  readonly createOpen = signal(false);
  readonly createPickedKind = signal<EvaluatorKind | null>(null);
  readonly createName = signal('');
  readonly createSystemMessage = signal('');
  readonly createEndpointId = signal<string | null>(null);
  readonly createJsonSchema = signal('');
  readonly createExtractionPattern = signal('');
  readonly createTolerance = signal('0.01');
  readonly createInProgress = signal(false);
  readonly createError = signal<string | null>(null);
  readonly endpoints = signal<ModelEndpointDto[]>([]);
  readonly endpointsLoading = signal(false);

  // ── derived ───────────────────────────────────────────────────────────────
  readonly visible = computed(() => {
    const filter = this.typeFilter();
    const all = this.evaluators();
    if (filter === 'all') return all;
    return all.filter(e => EVALUATOR_TYPE_META[e.kind as EvaluatorKind]?.group === filter);
  });

  readonly selected = computed(() => {
    const id = this.selectedId();
    if (!id) return this.visible()[0] ?? null;
    return this.evaluators().find(e => e.id === id) ?? this.visible()[0] ?? null;
  });

  readonly llmCount = computed(() =>
    this.evaluators().filter(e => EVALUATOR_TYPE_META[e.kind as EvaluatorKind]?.group === 'llm').length);

  readonly ruleCount = computed(() =>
    this.evaluators().filter(e => EVALUATOR_TYPE_META[e.kind as EvaluatorKind]?.group === 'rule').length);

  readonly pickedMeta = computed(() => {
    const k = this.createPickedKind();
    return k !== null ? EVALUATOR_TYPE_META[k] : null;
  });

  readonly createValid = computed(() => {
    const k = this.createPickedKind();
    if (k === null) return false;
    const meta = EVALUATOR_TYPE_META[k];
    if (k === EvaluatorKind.Custom) {
      return this.createName().trim().length > 0 && this.createSystemMessage().trim().length > 0 && !!this.createEndpointId();
    }
    if (meta.requiresEndpoint) return !!this.createEndpointId();
    if (k === EvaluatorKind.JsonSchemaMatch) return this.createJsonSchema().trim().length > 0;
    if (k === EvaluatorKind.NumericMatch) return this.createExtractionPattern().trim().length > 0;
    return true;
  });

  readonly deleteTarget = computed(() =>
    this.evaluators().find(e => e.id === this.deleteTargetId()) ?? null);

  readonly editTarget = computed(() =>
    this.evaluators().find(e => e.id === this.editTargetId()) ?? null);

  readonly editValid = computed(() => {
    const ev = this.editTarget();
    if (!ev) return false;
    if (ev.kind === EvaluatorKind.Custom) {
      return this.editName().trim().length > 0 && this.editSystemMessage().trim().length > 0;
    }
    return true;
  });

  ngOnInit() {
    this.loadEvaluators();
  }

  private loadEvaluators() {
    this.loading.set(true);
    this.evaluatorsService.getAll().subscribe({
      next: (data) => {
        this.evaluators.set(data);
        if (!this.selectedId() && data.length > 0) this.selectedId.set(data[0].id);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message ?? 'Failed to load evaluators.');
        this.loading.set(false);
      },
    });
  }

  selectEvaluator(id: string) {
    this.selectedId.set(id);
  }

  setTypeFilter(filter: TypeFilter) {
    this.typeFilter.set(filter);
  }

  openCreate() {
    this.createOpen.set(true);
    this.createPickedKind.set(null);
    this.createName.set('');
    this.createSystemMessage.set('');
    this.createEndpointId.set(null);
    this.createJsonSchema.set('');
    this.createExtractionPattern.set('');
    this.createTolerance.set('0.01');
    this.createError.set(null);
    this.loadEndpoints();
  }

  closeCreate() {
    this.createOpen.set(false);
  }

  pickKind(kind: EvaluatorKind) {
    this.createPickedKind.set(kind);
    this.createEndpointId.set(this.endpoints()[0]?.id ?? null);
  }

  private loadEndpoints() {
    this.endpointsLoading.set(true);
    this.providersService.getAllModels().subscribe({
      next: (eps) => {
        this.endpoints.set(eps);
        if (eps.length > 0 && !this.createEndpointId()) this.createEndpointId.set(eps[0].id);
        this.endpointsLoading.set(false);
      },
      error: () => this.endpointsLoading.set(false),
    });
  }

  submitCreate() {
    const k = this.createPickedKind();
    if (k === null || !this.createValid()) return;

    const payload: CreateEvaluatorPayload = { kind: k };

    if (k === EvaluatorKind.Custom) {
      payload.name = this.createName().trim();
      payload.systemMessage = this.createSystemMessage().trim();
      payload.endpointId = this.createEndpointId();
    } else if (EVALUATOR_TYPE_META[k].requiresEndpoint) {
      payload.endpointId = this.createEndpointId();
    } else if (k === EvaluatorKind.JsonSchemaMatch) {
      payload.jsonSchema = this.createJsonSchema().trim();
    } else if (k === EvaluatorKind.NumericMatch) {
      payload.extractionPattern = this.createExtractionPattern().trim();
      payload.tolerance = parseFloat(this.createTolerance()) || 0.01;
    }

    this.createInProgress.set(true);
    this.createError.set(null);
    this.evaluatorsService.create(payload).subscribe({
      next: (created) => {
        this.evaluators.update(list => [...list, created]);
        this.selectedId.set(created.id);
        this.createInProgress.set(false);
        this.createOpen.set(false);
      },
      error: (err) => {
        this.createError.set(err.error ?? err.message ?? 'Failed to create evaluator.');
        this.createInProgress.set(false);
      },
    });
  }

  openDelete(id: string, event: Event) {
    event.stopPropagation();
    this.deleteTargetId.set(id);
    this.deleteError.set(null);
  }

  closeDelete() {
    this.deleteTargetId.set(null);
  }

  confirmDelete() {
    const id = this.deleteTargetId();
    if (!id) return;
    this.deleteInProgress.set(true);
    this.evaluatorsService.delete(id).subscribe({
      next: () => {
        this.evaluators.update(list => list.filter(e => e.id !== id));
        if (this.selectedId() === id) this.selectedId.set(this.evaluators()[0]?.id ?? null);
        this.deleteInProgress.set(false);
        this.deleteTargetId.set(null);
      },
      error: (err) => {
        this.deleteError.set(err.message ?? 'Failed to delete evaluator.');
        this.deleteInProgress.set(false);
      },
    });
  }

  openEdit(id: string, event?: Event) {
    event?.stopPropagation();
    const ev = this.evaluators().find(e => e.id === id);
    if (!ev) return;
    this.editTargetId.set(id);
    this.editName.set(ev.name);
    this.editSystemMessage.set(ev.systemMessage ?? '');
    this.editEndpointId.set(ev.endpointId);
    this.editJsonSchema.set(ev.jsonSchema ?? '');
    this.editExtractionPattern.set(ev.extractionPattern ?? '');
    this.editTolerance.set(String(ev.tolerance ?? 0.01));
    this.editError.set(null);
    this.editOpen.set(true);
    this.loadEndpoints();
  }

  closeEdit() {
    this.editOpen.set(false);
    this.editTargetId.set(null);
  }

  submitEdit() {
    const ev = this.editTarget();
    if (!ev || !this.editValid()) return;

    const payload: Partial<CreateEvaluatorPayload> = {};

    if (ev.kind === EvaluatorKind.Custom) {
      payload.name = this.editName().trim();
      payload.systemMessage = this.editSystemMessage().trim();
      payload.endpointId = this.editEndpointId();
    } else if (EVALUATOR_TYPE_META[ev.kind]?.requiresEndpoint) {
      payload.endpointId = this.editEndpointId();
    } else if (ev.kind === EvaluatorKind.JsonSchemaMatch) {
      payload.jsonSchema = this.editJsonSchema().trim();
    } else if (ev.kind === EvaluatorKind.NumericMatch) {
      payload.extractionPattern = this.editExtractionPattern().trim();
      payload.tolerance = parseFloat(this.editTolerance()) || 0.01;
    }

    this.editInProgress.set(true);
    this.editError.set(null);
    this.evaluatorsService.update(ev.id, payload).subscribe({
      next: (saved) => {
        this.evaluators.update(list => list.map(e => e.id === saved.id ? saved : e));
        this.editInProgress.set(false);
        this.editOpen.set(false);
        this.editTargetId.set(null);
      },
      error: (err) => {
        this.editError.set(err.error ?? err.message ?? 'Failed to save changes.');
        this.editInProgress.set(false);
      },
    });
  }

  kindLabel(kind: EvaluatorKind): string {
    return EVALUATOR_TYPE_META[kind]?.label ?? kind.toString();
  }

  kindColor(kind: EvaluatorKind): string {
    return EVALUATOR_TYPE_META[kind]?.color ?? '#c9944a';
  }

  kindShort(kind: EvaluatorKind): string {
    return EVALUATOR_TYPE_META[kind]?.short ?? '';
  }

  isSelected(id: string): boolean {
    return this.selected()?.id === id;
  }

  typeFilterCount(filter: TypeFilter): number {
    const all = this.evaluators();
    if (filter === 'all') return all.length;
    return all.filter(e => EVALUATOR_TYPE_META[e.kind as EvaluatorKind]?.group === filter).length;
  }
}
