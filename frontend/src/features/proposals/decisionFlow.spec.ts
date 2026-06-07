import { describe, expect, it } from 'vitest';
import type { OptimizationProposalDto, TheoryDto } from '../../api/models';
import { Priority, ProposalKind, ProposalStatus, TheorySource, TheoryStatus } from '../../api/models';
import { buildDecisionFlow, type FlowStageKey, type FlowState } from './decisionFlow';

function theory(overrides: Partial<TheoryDto> = {}): TheoryDto {
  return {
    id: 't1', kind: ProposalKind.SystemPrompt, status: TheoryStatus.Proposed, source: TheorySource.Optimizer,
    agentId: 'a1', agentName: 'Agent', suiteId: 's1', priority: Priority.Medium, rationale: 'r',
    details: { kind: 'SystemPrompt', currentSystemMessage: 'a', proposedSystemMessage: 'b' },
    evidenceTestRunIds: ['r1', 'r2'], resultingProposalId: null,
    baselinePassRate: null, projectedPassRate: null, pValue: null, abTestRunId: null,
    createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-01T00:00:00Z', ...overrides,
  };
}

function proposal(status: ProposalStatus): OptimizationProposalDto {
  return {
    id: 'p1', kind: ProposalKind.SystemPrompt, status, agentId: 'a1', agentName: 'Agent', priority: Priority.Medium,
    rationale: 'r', details: { kind: 'SystemPrompt', currentSystemMessage: 'a', proposedSystemMessage: 'b' },
    evidenceTestRunIds: [], abTestRun: null, currentPassRate: 0.7, proposedPassRate: 0.9, expectedPassRateDelta: 0.2,
    createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-01T00:00:00Z',
  };
}

const state = (stages: ReturnType<typeof buildDecisionFlow>, key: FlowStageKey): FlowState =>
  stages.find(s => s.key === key)!.state;

describe('buildDecisionFlow', () => {
  it('always yields the five stages in order', () => {
    expect(buildDecisionFlow(theory(), null).map(s => s.key))
      .toEqual(['evidence', 'theory', 'abTest', 'proposal', 'outcome']);
  });

  it('Proposed: evidence/theory complete, the rest pending', () => {
    const f = buildDecisionFlow(theory({ status: TheoryStatus.Proposed }), null);
    expect(state(f, 'evidence')).toBe('complete');
    expect(state(f, 'theory')).toBe('complete');
    expect(state(f, 'abTest')).toBe('pending');
    expect(state(f, 'proposal')).toBe('pending');
    expect(state(f, 'outcome')).toBe('pending');
  });

  it('Validating: A/B is current', () => {
    const f = buildDecisionFlow(theory({ status: TheoryStatus.Validating }), null);
    expect(state(f, 'abTest')).toBe('current');
    expect(f.find(s => s.key === 'abTest')!.statusLabel).toBe('In flight');
  });

  it('Invalidated: A/B + proposal + outcome all rejected (auto)', () => {
    const f = buildDecisionFlow(theory({ status: TheoryStatus.Invalidated }), null);
    expect(state(f, 'abTest')).toBe('rejected');
    expect(state(f, 'proposal')).toBe('rejected');
    expect(state(f, 'outcome')).toBe('rejected');
    expect(f.find(s => s.key === 'outcome')!.statusLabel).toBe('Auto-rejected by A/B');
  });

  it('Validated + Draft proposal: outcome awaits user review', () => {
    const f = buildDecisionFlow(theory({ status: TheoryStatus.Validated, resultingProposalId: 'p1' }), proposal(ProposalStatus.Draft));
    expect(state(f, 'abTest')).toBe('complete');
    expect(state(f, 'proposal')).toBe('complete');
    expect(state(f, 'outcome')).toBe('current');
    expect(f.find(s => s.key === 'outcome')!.statusLabel).toBe('Pending review');
  });

  it('Validated + Accepted proposal: promoted', () => {
    const f = buildDecisionFlow(theory({ status: TheoryStatus.Validated }), proposal(ProposalStatus.Accepted));
    expect(state(f, 'outcome')).toBe('complete');
    expect(f.find(s => s.key === 'outcome')!.statusLabel).toBe('Promoted');
  });

  it('Validated + Rejected proposal: dismissed by user', () => {
    const f = buildDecisionFlow(theory({ status: TheoryStatus.Validated }), proposal(ProposalStatus.Rejected));
    expect(state(f, 'outcome')).toBe('rejected');
    expect(f.find(s => s.key === 'outcome')!.statusLabel).toBe('Dismissed');
  });

  it('reports evidence count, or direct submission when none', () => {
    expect(buildDecisionFlow(theory({ evidenceTestRunIds: ['r1', 'r2'] }), null)[0].statusLabel).toBe('2 failing runs');
    expect(buildDecisionFlow(theory({ evidenceTestRunIds: [] }), null)[0].statusLabel).toBe('Submitted directly');
  });
});
