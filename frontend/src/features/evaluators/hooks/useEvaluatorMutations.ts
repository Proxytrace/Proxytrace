import { useMutation, useQueryClient } from '@tanstack/react-query';
import { evaluatorsApi, type EvaluatorsOverviewDto } from '../../../api/evaluators';
import {
  EvaluatorKind,
  type CreateEvaluatorPayload,
  type EvaluatorDetailDto,
  type UpdateEvaluatorPayload,
} from '../../../api/models';
import type { EvaluatorFormState } from '../evaluatorMeta';

function buildCreatePayload(
  kind: EvaluatorKind,
  projectId: string,
  form: EvaluatorFormState,
): CreateEvaluatorPayload {
  switch (kind) {
    case EvaluatorKind.Agentic:
      return { kind, projectId, name: form.name, systemMessage: form.systemMessage };
    case EvaluatorKind.ExactMatch:
      return { kind, projectId };
    case EvaluatorKind.NumericMatch:
      return {
        kind,
        projectId,
        extractionPattern: form.extractionPattern,
        tolerance: parseFloat(form.tolerance) || 0.01,
      };
    case EvaluatorKind.JsonSchemaMatch:
      return { kind, projectId, jsonSchema: form.jsonSchema };
  }
}

function buildUpdatePayload(kind: EvaluatorKind, form: EvaluatorFormState): UpdateEvaluatorPayload {
  switch (kind) {
    case EvaluatorKind.Agentic:
      return { kind, name: form.name, systemMessage: form.systemMessage };
    case EvaluatorKind.ExactMatch:
      return { kind };
    case EvaluatorKind.NumericMatch:
      return {
        kind,
        extractionPattern: form.extractionPattern,
        tolerance: parseFloat(form.tolerance) || 0.01,
      };
    case EvaluatorKind.JsonSchemaMatch:
      return { kind, jsonSchema: form.jsonSchema };
  }
}

export interface CreateEvaluatorArgs {
  kind: EvaluatorKind;
  projectId: string;
  form: EvaluatorFormState;
}

/** Creates an evaluator. The mutation result is the new evaluator (caller navigates). */
export function useCreateEvaluator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, projectId: pid, form }: CreateEvaluatorArgs) =>
      evaluatorsApi.create(buildCreatePayload(kind, pid, form)),
    // Invalidate the whole evaluators namespace: the rail list, the overview (which feeds the
    // selectable list), and per-evaluator detail are all keyed under ['evaluators', …] but with
    // different second segments, so a projectId-scoped key would miss the overview.
    onSuccess: () => qc.invalidateQueries({ queryKey: ['evaluators'] }),
  });
}

export interface UpdateEvaluatorArgs {
  id: string;
  kind: EvaluatorKind;
  form: EvaluatorFormState;
}

/** Updates an evaluator's kind-specific fields. */
export function useUpdateEvaluator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, kind, form }: UpdateEvaluatorArgs) =>
      evaluatorsApi.update(id, buildUpdatePayload(kind, form)),
    // Invalidate the whole evaluators namespace: the rail list, the overview (which feeds the
    // selectable list), and per-evaluator detail are all keyed under ['evaluators', …] but with
    // different second segments, so a projectId-scoped key would miss the overview.
    onSuccess: () => qc.invalidateQueries({ queryKey: ['evaluators'] }),
  });
}

/** Deletes an evaluator by id. */
export function useDeleteEvaluator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => evaluatorsApi.delete(id),
    onSuccess: (_data, id) => {
      // Drop the deleted evaluator from the cached overview(s) synchronously so the detail view
      // for it stops being rendered. Without this, the broad invalidation below would refetch the
      // now-deleted evaluator's still-mounted detail query and hit a 404.
      qc.setQueriesData<EvaluatorsOverviewDto>(
        { queryKey: ['evaluators', 'overview'] },
        prev => (prev ? { ...prev, evaluators: prev.evaluators.filter(e => e.id !== id) } : prev),
      );
      // Reconcile every evaluators query EXCEPT per-evaluator detail — refetching the deleted
      // evaluator's detail is exactly the 404 we're avoiding, and the surviving selection's detail
      // refetches itself on mount.
      qc.invalidateQueries({
        queryKey: ['evaluators'],
        predicate: q => q.queryKey[1] !== 'detail',
      });
    },
  });
}

/** Builds the edit-form initial state from an existing evaluator. */
export function formFromEvaluator(e: EvaluatorDetailDto): EvaluatorFormState {
  return {
    name: e.name,
    systemMessage: e.systemMessage ?? '',
    presetKey: '',
    jsonSchema: e.jsonSchema ?? '',
    extractionPattern: e.extractionPattern ?? '',
    tolerance: String(e.tolerance ?? 0.01),
  };
}
