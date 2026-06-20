import { beforeAll, describe, expect, it } from 'vitest';
import { i18n } from '../../i18n';
import type { AbTestRunSummaryDto, OptimizationProposalDto, TheoryDto } from '../../api/models';
import { Priority, ProposalKind, ProposalStatus, TestRunStatus, TheorySource, TheoryStatus } from '../../api/models';
import { adoptionLabel, buildGainSummary, formatDeltaPt } from './validatedView';

// Activate an empty catalog so i18n._() resolves MessageDescriptors to their source strings.
beforeAll(() => i18n.loadAndActivate({ locale: 'en', messages: {} }));

function makeTheory(overrides: Partial<TheoryDto> = {}): TheoryDto {
  return {
    id: '6c47abcd-0000-0000-0000-000000000000',
    kind: ProposalKind.SystemPrompt,
    status: TheoryStatus.Validated,
    source: TheorySource.Optimizer,
    agentId: 'agent-1',
    agentName: 'Code Helper',
    suiteId: 'suite-1',
    priority: Priority.Medium,
    rationale: 'A hypothesis.',
    details: { kind: 'SystemPrompt', currentSystemMessage: 'a', proposedSystemMessage: 'b' },
    evidenceTestRunIds: [],
    resultingProposalId: null,
    baselinePassRate: null,
    projectedPassRate: null,
    pValue: null,
    abTestRunId: null,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    ...overrides,
  };
}

function makeAbRun(overrides: Partial<AbTestRunSummaryDto> = {}): AbTestRunSummaryDto {
  return {
    id: 'run-1',
    groupId: 'group-1',
    status: TestRunStatus.Completed,
    totalCases: 10,
    completedCases: 10,
    passedCases: 9,
    failedCases: 1,
    passRate: 90,
    startedAt: '2026-06-01T00:00:00Z',
    completedAt: '2026-06-01T00:01:00Z',
    durationMs: 60_000,
    ...overrides,
  };
}

function makeProposal(overrides: Partial<OptimizationProposalDto> = {}): OptimizationProposalDto {
  return {
    id: 'prop-1',
    kind: ProposalKind.SystemPrompt,
    status: ProposalStatus.Draft,
    agentId: 'agent-1',
    agentName: 'Code Helper',
    priority: Priority.Medium,
    rationale: 'A hypothesis.',
    details: { kind: 'SystemPrompt', currentSystemMessage: 'a', proposedSystemMessage: 'b' },
    evidenceTestRunIds: [],
    abTestRun: null,
    currentPassRate: null,
    proposedPassRate: null,
    expectedPassRateDelta: null,
    adoptedAt: null,
    adoptedAgentVersionId: null,
    adoptedAgentVersionNumber: null,
    adoptedManually: null,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    ...overrides,
  };
}

describe('buildGainSummary', () => {
  it('uses the recorded theory metrics when present', () => {
    const gain = buildGainSummary(makeTheory({ baselinePassRate: 0.78, projectedPassRate: 0.9 }), null);
    expect(gain).toEqual({ fromPct: 78, toPct: 90, deltaPt: 12 });
  });

  it('falls back to the A/B run summary when the theory carries no metrics', () => {
    const proposal = makeProposal({ abTestRun: makeAbRun({ passRate: 90 }), expectedPassRateDelta: 0.12 });
    const gain = buildGainSummary(makeTheory(), proposal);
    expect(gain).toEqual({ fromPct: 78, toPct: 90, deltaPt: 12 });
  });

  it('reports an unknown baseline when the A/B run has no predicted delta', () => {
    const proposal = makeProposal({ abTestRun: makeAbRun({ passRate: 85 }) });
    const gain = buildGainSummary(makeTheory(), proposal);
    expect(gain).toEqual({ fromPct: null, toPct: 85, deltaPt: null });
  });

  it('ignores an A/B run with no completed cases', () => {
    const proposal = makeProposal({ abTestRun: makeAbRun({ completedCases: 0 }) });
    expect(buildGainSummary(makeTheory(), proposal)).toBeNull();
  });

  it('returns null when neither source has metrics', () => {
    expect(buildGainSummary(makeTheory(), null)).toBeNull();
  });
});

describe('formatDeltaPt', () => {
  it('signs positive, negative, and zero deltas', () => {
    expect(formatDeltaPt(12)).toBe('+12pt');
    expect(formatDeltaPt(-3)).toBe('−3pt');
    expect(formatDeltaPt(0)).toBe('±0pt');
  });
});

describe('adoptionLabel', () => {
  it('names the detected agent version when auto-adopted', () => {
    const proposal = makeProposal({
      status: ProposalStatus.Adopted,
      adoptedAt: '2026-06-12T00:00:00Z',
      adoptedAgentVersionId: 'ver-1',
      adoptedAgentVersionNumber: 4,
      adoptedManually: false,
    });
    expect(i18n._(adoptionLabel(proposal))).toBe('Adopted in v4');
  });

  it('says marked adopted for manual confirmations', () => {
    const proposal = makeProposal({
      status: ProposalStatus.Adopted,
      adoptedAt: '2026-06-12T00:00:00Z',
      adoptedManually: true,
    });
    expect(i18n._(adoptionLabel(proposal))).toBe('Marked adopted');
  });

  it('falls back to a plain label without version or manual flag', () => {
    expect(i18n._(adoptionLabel(makeProposal({ status: ProposalStatus.Adopted })))).toBe('Adopted');
  });
});
