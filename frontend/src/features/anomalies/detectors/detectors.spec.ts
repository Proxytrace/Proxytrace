import { describe, it, expect } from 'vitest';
import { TriggerKind, type CustomAnomalyDetectorDto } from '../../../api/models';
import {
  buildCreatePayload,
  buildUpdatePayload,
  formFromDetector,
  initDetectorForm,
  isValidRegex,
  validateDetectorForm,
  type DetectorFormState,
} from './detectors';

function validForm(overrides: Partial<DetectorFormState> = {}): DetectorFormState {
  return {
    name: 'Refund watcher',
    instructions: 'Flag turns that promise a refund without approval.',
    endpointId: 'ep-1',
    triggers: [{ kind: TriggerKind.Phrase, pattern: 'refund' }],
    allAgents: true,
    agentIds: [],
    isEnabled: true,
    blockUpstream: false,
    ...overrides,
  };
}

describe('validateDetectorForm', () => {
  it('accepts a well-formed detector', () => {
    expect(validateDetectorForm(validForm())).toBeNull();
  });

  it('requires a name and instructions', () => {
    expect(validateDetectorForm(validForm({ name: '  ' }))).toBe('name');
    expect(validateDetectorForm(validForm({ instructions: '' }))).toBe('instructions');
  });

  it('requires between 1 and 20 triggers', () => {
    expect(validateDetectorForm(validForm({ triggers: [] }))).toBe('triggers');
    const many = Array.from({ length: 21 }, () => ({ kind: TriggerKind.Phrase, pattern: 'x' }));
    expect(validateDetectorForm(validForm({ triggers: many }))).toBe('triggers');
  });

  it('rejects an empty trigger pattern and an invalid regex', () => {
    expect(validateDetectorForm(validForm({ triggers: [{ kind: TriggerKind.Phrase, pattern: '  ' }] }))).toBe('trigger-pattern');
    expect(validateDetectorForm(validForm({ triggers: [{ kind: TriggerKind.Regex, pattern: '(' }] }))).toBe('regex');
    expect(validateDetectorForm(validForm({ triggers: [{ kind: TriggerKind.Regex, pattern: 'ab+c' }] }))).toBeNull();
  });

  it('requires an endpoint', () => {
    expect(validateDetectorForm(validForm({ endpointId: '' }))).toBe('endpoint');
  });

  it('requires at least one agent when not applying to all', () => {
    expect(validateDetectorForm(validForm({ allAgents: false, agentIds: [] }))).toBe('agents');
    expect(validateDetectorForm(validForm({ allAgents: false, agentIds: ['a1'] }))).toBeNull();
  });
});

describe('isValidRegex', () => {
  it('distinguishes valid from invalid patterns', () => {
    expect(isValidRegex('a.*b')).toBe(true);
    expect(isValidRegex('[unterminated')).toBe(false);
  });
});

describe('payload builders', () => {
  it('trims fields and omits agentIds when applying to all agents', () => {
    const payload = buildCreatePayload('proj-1', validForm({ name: '  Trim  ', triggers: [{ kind: TriggerKind.Phrase, pattern: '  hi  ' }] }));
    expect(payload.name).toBe('Trim');
    expect(payload.triggers[0].pattern).toBe('hi');
    expect(payload.agentIds).toBeUndefined();
    expect(payload.projectId).toBe('proj-1');
  });

  it('includes agentIds when scoped to specific agents', () => {
    const payload = buildUpdatePayload(validForm({ allAgents: false, agentIds: ['a1', 'a2'] }));
    expect(payload.allAgents).toBe(false);
    expect(payload.agentIds).toEqual(['a1', 'a2']);
  });

  it('carries blockUpstream through both payloads', () => {
    expect(buildCreatePayload('proj-1', validForm({ blockUpstream: true })).blockUpstream).toBe(true);
    expect(buildUpdatePayload(validForm({ blockUpstream: true })).blockUpstream).toBe(true);
    expect(buildUpdatePayload(validForm()).blockUpstream).toBe(false);
  });
});

describe('form seeding', () => {
  it('initDetectorForm seeds one empty phrase trigger and an endpoint', () => {
    const form = initDetectorForm('ep-9');
    expect(form.endpointId).toBe('ep-9');
    expect(form.triggers).toEqual([{ kind: TriggerKind.Phrase, pattern: '' }]);
    expect(form.allAgents).toBe(true);
  });

  it('formFromDetector round-trips a detector and clones its arrays', () => {
    const detector: CustomAnomalyDetectorDto = {
      id: 'd1', name: 'D', instructions: 'I', projectId: 'p', endpointId: 'e', endpointName: 'gpt',
      triggers: [{ kind: TriggerKind.Regex, pattern: 'x' }], allAgents: false, agentIds: ['a1'],
      isEnabled: false, blockUpstream: true, createdAt: 't', updatedAt: 't',
    };
    const form = formFromDetector(detector);
    expect(form).toMatchObject({ name: 'D', instructions: 'I', endpointId: 'e', allAgents: false, isEnabled: false, blockUpstream: true });
    form.triggers[0].pattern = 'mutated';
    form.agentIds.push('a2');
    expect(detector.triggers[0].pattern).toBe('x'); // clone, not shared
    expect(detector.agentIds).toEqual(['a1']);
  });
});
