import { describe, expect, it } from 'vitest';
import type { TheoryDto } from '../../api/models';
import { Priority, ProposalKind, TheorySource, TheoryStatus } from '../../api/models';
import {
  boardStats,
  groupByColumn,
  isInsideNoise,
  passRateDeltaPt,
  passRateTransition,
  theoryShortId,
} from './theoryBoard';

function makeTheory(overrides: Partial<TheoryDto> = {}): TheoryDto {
  return {
    id: '6c47abcd-0000-0000-0000-000000000000',
    kind: ProposalKind.SystemPrompt,
    status: TheoryStatus.Proposed,
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
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    ...overrides,
  };
}

describe('groupByColumn', () => {
  it('places each theory in its status bucket and keeps the others empty', () => {
    const groups = groupByColumn([
      makeTheory({ status: TheoryStatus.Proposed }),
      makeTheory({ status: TheoryStatus.Proposed }),
      makeTheory({ status: TheoryStatus.Validated }),
    ]);

    expect(groups[TheoryStatus.Proposed]).toHaveLength(2);
    expect(groups[TheoryStatus.Validated]).toHaveLength(1);
    expect(groups[TheoryStatus.Validating]).toHaveLength(0);
    expect(groups[TheoryStatus.Invalidated]).toHaveLength(0);
  });
});

describe('boardStats', () => {
  it('counts tested as validated + rejected and computes the win rate', () => {
    const stats = boardStats([
      makeTheory({ status: TheoryStatus.Proposed }),
      makeTheory({ status: TheoryStatus.Validating }),
      makeTheory({ status: TheoryStatus.Validated, baselinePassRate: 0.78, projectedPassRate: 0.9 }),
      makeTheory({ status: TheoryStatus.Validated, baselinePassRate: 0.71, projectedPassRate: 0.78 }),
      makeTheory({ status: TheoryStatus.Invalidated, baselinePassRate: 0.89, projectedPassRate: 0.9 }),
    ]);

    expect(stats.theories).toBe(5);
    expect(stats.tested).toBe(3);
    expect(stats.winRate).toBe(67); // 2 of 3 tested validated
    expect(stats.provenGainPt).toBe(19); // 12 + 7
  });

  it('returns a null win rate when nothing has been tested', () => {
    const stats = boardStats([makeTheory({ status: TheoryStatus.Proposed })]);
    expect(stats.tested).toBe(0);
    expect(stats.winRate).toBeNull();
    expect(stats.provenGainPt).toBe(0);
  });

  it('ignores non-positive deltas in proven gain', () => {
    const stats = boardStats([
      makeTheory({ status: TheoryStatus.Validated, baselinePassRate: 0.9, projectedPassRate: 0.9 }),
    ]);
    expect(stats.provenGainPt).toBe(0);
  });
});

describe('theoryShortId', () => {
  it('builds a thy_ handle from the first hex characters', () => {
    expect(theoryShortId('6c47abcd-0000-0000-0000-000000000000')).toBe('thy_6c47');
  });

  it('falls back to zeros when the id has no hex', () => {
    expect(theoryShortId('zzzz')).toBe('thy_0000');
  });
});

describe('passRateTransition', () => {
  it('returns rounded from/to/delta when both rates are present', () => {
    const t = passRateTransition(makeTheory({ baselinePassRate: 0.781, projectedPassRate: 0.904 }));
    expect(t).toEqual({ fromPct: 78, toPct: 90, deltaPt: 12 });
  });

  it('returns null when a rate is missing', () => {
    expect(passRateTransition(makeTheory({ baselinePassRate: 0.5, projectedPassRate: null }))).toBeNull();
    expect(passRateDeltaPt(makeTheory())).toBeNull();
  });
});

describe('isInsideNoise', () => {
  it('treats p ≥ 0.05 as noise and lower as significant', () => {
    expect(isInsideNoise(0.41)).toBe(true);
    expect(isInsideNoise(0.05)).toBe(true);
    expect(isInsideNoise(0.008)).toBe(false);
    expect(isInsideNoise(null)).toBe(false);
  });
});
