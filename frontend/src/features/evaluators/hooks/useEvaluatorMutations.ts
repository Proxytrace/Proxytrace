import { useMutation, useQueryClient } from '@tanstack/react-query';
import { evaluatorsApi } from '../../../api/evaluators';
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
    // Invalidate the whole evaluators namespace: the rail list, the overview (which feeds the
    // selectable list), and per-evaluator detail are all keyed under ['evaluators', …] but with
    // different second segments, so a projectId-scoped key would miss the overview.
    onSuccess: () => qc.invalidateQueries({ queryKey: ['evaluators'] }),
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
