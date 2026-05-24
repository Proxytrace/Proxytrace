import { useMutation, useQueryClient } from '@tanstack/react-query';
import { evaluatorsApi } from '../../../api/evaluators';
import { QUERY_KEYS } from '../../../api/query-keys';
import {
  EvaluatorKind,
  type CreateEvaluatorPayload,
  type EvaluatorDetailDto,
} from '../../../api/models';
import type { EvaluatorFormState } from '../evaluatorMeta';

/** Builds the kind-specific subset of an evaluator payload from the form state. */
function kindFields(kind: EvaluatorKind, form: EvaluatorFormState): Partial<CreateEvaluatorPayload> {
  if (kind === EvaluatorKind.Agentic) return { name: form.name, systemMessage: form.systemMessage };
  if (kind === EvaluatorKind.JsonSchemaMatch) return { jsonSchema: form.jsonSchema };
  if (kind === EvaluatorKind.NumericMatch) {
    return { extractionPattern: form.extractionPattern, tolerance: parseFloat(form.tolerance) || 0.01 };
  }
  return {};
}

export interface CreateEvaluatorArgs {
  kind: EvaluatorKind;
  projectId: string;
  form: EvaluatorFormState;
}

/** Creates an evaluator. The mutation result is the new evaluator (caller navigates). */
export function useCreateEvaluator(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, projectId: pid, form }: CreateEvaluatorArgs) => {
      const payload: CreateEvaluatorPayload = { kind, projectId: pid, ...kindFields(kind, form) };
      return evaluatorsApi.create(payload);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.evaluators(projectId ?? undefined) }),
  });
}

export interface UpdateEvaluatorArgs {
  id: string;
  kind: EvaluatorKind;
  form: EvaluatorFormState;
}

/** Updates an evaluator's kind-specific fields. */
export function useUpdateEvaluator(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, kind, form }: UpdateEvaluatorArgs) =>
      evaluatorsApi.update(id, kindFields(kind, form)),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.evaluators(projectId ?? undefined) }),
  });
}

/** Deletes an evaluator by id. */
export function useDeleteEvaluator(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => evaluatorsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.evaluators(projectId ?? undefined) }),
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
