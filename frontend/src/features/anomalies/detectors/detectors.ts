import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';
import {
  TriggerKind,
  type AnomalyTriggerDto,
  type CreateCustomAnomalyDetectorRequest,
  type CustomAnomalyDetectorDto,
  type UpdateCustomAnomalyDetectorRequest,
} from '../../../api/models';

/** Mirrors backend `ICustomAnomalyDetector.MaxTriggers`. */
export const MAX_TRIGGERS = 20;

/** Editable detector form state (create + edit share it). */
export interface DetectorFormState {
  name: string;
  instructions: string;
  endpointId: string;
  triggers: AnomalyTriggerDto[];
  allAgents: boolean;
  agentIds: string[];
  isEnabled: boolean;
}

export function initDetectorForm(endpointId = ''): DetectorFormState {
  return {
    name: '',
    instructions: '',
    endpointId,
    triggers: [{ kind: TriggerKind.Phrase, pattern: '' }],
    allAgents: true,
    agentIds: [],
    isEnabled: true,
  };
}

export function formFromDetector(d: CustomAnomalyDetectorDto): DetectorFormState {
  return {
    name: d.name,
    instructions: d.instructions,
    endpointId: d.endpointId,
    triggers: d.triggers.map(t => ({ ...t })),
    allAgents: d.allAgents,
    agentIds: [...d.agentIds],
    isEnabled: d.isEnabled,
  };
}

/** Validation failure code (mapped to a localized message at the leaf via {@link DETECTOR_ERROR_LABEL}).
 * Mirrors the backend `ValidateRequest` rules so the user sees the error before submitting; the
 * backend re-validates authoritatively (a regex is finally checked with `NonBacktracking`). */
export type DetectorFormError = 'name' | 'instructions' | 'triggers' | 'trigger-pattern' | 'regex' | 'endpoint' | 'agents';

export const DETECTOR_ERROR_LABEL: Record<DetectorFormError, MessageDescriptor> = {
  name: msg`Name is required.`,
  instructions: msg`Review instructions are required.`,
  triggers: msg`Add between 1 and ${MAX_TRIGGERS} triggers.`,
  'trigger-pattern': msg`Every trigger needs a pattern.`,
  regex: msg`One of the regex triggers is not a valid pattern.`,
  endpoint: msg`Choose a judge model endpoint.`,
  agents: msg`Select at least one agent, or apply to all agents.`,
};

export function validateDetectorForm(form: DetectorFormState): DetectorFormError | null {
  if (!form.name.trim()) return 'name';
  if (!form.instructions.trim()) return 'instructions';
  if (form.triggers.length === 0 || form.triggers.length > MAX_TRIGGERS) return 'triggers';
  for (const trigger of form.triggers) {
    if (!trigger.pattern.trim()) return 'trigger-pattern';
    if (trigger.kind === TriggerKind.Regex && !isValidRegex(trigger.pattern)) return 'regex';
  }
  if (!form.endpointId) return 'endpoint';
  if (!form.allAgents && form.agentIds.length === 0) return 'agents';
  return null;
}

/** Best-effort client check (the backend does the authoritative `NonBacktracking` compile). */
export function isValidRegex(pattern: string): boolean {
  try {
    // Construction is the validation; the compiled instance is discarded.
    void new RegExp(pattern, 'i');
    return true;
  } catch {
    return false;
  }
}

function normalizedTriggers(form: DetectorFormState): AnomalyTriggerDto[] {
  return form.triggers.map(t => ({ kind: t.kind, pattern: t.pattern.trim() }));
}

export function buildCreatePayload(projectId: string, form: DetectorFormState): CreateCustomAnomalyDetectorRequest {
  return {
    projectId,
    name: form.name.trim(),
    instructions: form.instructions.trim(),
    endpointId: form.endpointId,
    triggers: normalizedTriggers(form),
    allAgents: form.allAgents,
    agentIds: form.allAgents ? undefined : form.agentIds,
    isEnabled: form.isEnabled,
  };
}

export function buildUpdatePayload(form: DetectorFormState): UpdateCustomAnomalyDetectorRequest {
  return {
    name: form.name.trim(),
    instructions: form.instructions.trim(),
    endpointId: form.endpointId,
    triggers: normalizedTriggers(form),
    allAgents: form.allAgents,
    agentIds: form.allAgents ? undefined : form.agentIds,
    isEnabled: form.isEnabled,
  };
}

export const TRIGGER_KIND_LABEL: Record<TriggerKind, MessageDescriptor> = {
  [TriggerKind.Phrase]: msg`Phrase`,
  [TriggerKind.Regex]: msg`Regex`,
};
