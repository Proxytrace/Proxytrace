import { describe, it, expect } from 'vitest';
import { passRateColor, computeSuiteStats } from './suitesMeta';
import type { TestSuiteDto } from '../../api/models';

// Minimal stub satisfying the fields used by these helpers.
function makeSuite(passRate: number | null, testCases: number, totalRuns: number): TestSuiteDto {
  return {
    id: 'id',
    name: 'Suite',
    description: null,
    agentId: 'agent-1',
    agentName: 'Agent',
    testCases: Array.from({ length: testCases }, (_, i) => ({
      id: `tc-${i}`,
      input: '',
      expectedOutput: null,
      createdAt: '',
    })),
    evaluators: [],
    tags: [],
    passRate,
    prevPassRate: null,
    passRateTrend: [],
    totalRuns,
    lastRunAt: null,
    lastRunGroupId: null,
    createdAt: '',
    updatedAt: '',
  } as unknown as TestSuiteDto;
}

describe('passRateColor', () => {
  it('returns muted for null', () => {
    expect(passRateColor(null)).toBe('var(--text-muted)');
  });

  it('returns success for high pass rate (≥ PASS_RATE_WARN = 75)', () => {
    expect(passRateColor(100)).toBe('var(--success)');
    expect(passRateColor(75)).toBe('var(--success)');
  });

  it('returns warn for mid pass rate (≥ PASS_RATE_DANGER = 55, < 75)', () => {
    expect(passRateColor(74)).toBe('var(--warn)');
    expect(passRateColor(55)).toBe('var(--warn)');
  });

  it('returns danger for low pass rate (< 55)', () => {
    expect(passRateColor(54)).toBe('var(--danger)');
    expect(passRateColor(0)).toBe('var(--danger)');
  });
});

describe('computeSuiteStats', () => {
  it('returns zeros for empty list', () => {
    expect(computeSuiteStats([])).toEqual({ totalCases: 0, totalRuns: 0, avgPassRate: null });
  });

  it('sums cases and runs across suites', () => {
    const suites = [makeSuite(100, 3, 5), makeSuite(60, 2, 10)];
    const stats = computeSuiteStats(suites);
    expect(stats.totalCases).toBe(5);
    expect(stats.totalRuns).toBe(15);
  });

  it('averages pass rates, ignoring nulls', () => {
    const suites = [makeSuite(100, 1, 1), makeSuite(null, 1, 0), makeSuite(50, 1, 1)];
    const stats = computeSuiteStats(suites);
    // (100 + 50) / 2 = 75
    expect(stats.avgPassRate).toBe(75);
  });

  it('returns null avgPassRate when all suites have no pass rate', () => {
    const suites = [makeSuite(null, 1, 0)];
    expect(computeSuiteStats(suites).avgPassRate).toBeNull();
  });
});
