import { describe, it, expect } from 'vitest';
import { passRateColor, summarizePassRate, passRateDelta } from './passRate';
import type { AgentPassRatePointDto } from '../../api/models';

const pt = (passed: number, testCases: number): AgentPassRatePointDto =>
  ({ bucketStart: '2026-01-01T00:00:00Z', passed, testCases }) as AgentPassRatePointDto;

describe('passRateColor', () => {
  it('returns success at/above 80', () => {
    expect(passRateColor(80)).toBe('var(--success)');
    expect(passRateColor(100)).toBe('var(--success)');
  });
  it('returns accent between 50 and 79', () => {
    expect(passRateColor(50)).toBe('var(--accent-primary)');
    expect(passRateColor(79)).toBe('var(--accent-primary)');
  });
  it('returns warn below 50', () => {
    expect(passRateColor(49)).toBe('var(--warn)');
    expect(passRateColor(0)).toBe('var(--warn)');
  });
});

describe('summarizePassRate', () => {
  it('returns null overall when no cases', () => {
    const s = summarizePassRate([]);
    expect(s.overall).toBeNull();
    expect(s.totalCases).toBe(0);
    expect(s.trendValues).toEqual([]);
  });

  it('aggregates passed/cases across buckets', () => {
    const s = summarizePassRate([pt(8, 10), pt(6, 10)]);
    expect(s.totalPassed).toBe(14);
    expect(s.totalCases).toBe(20);
    expect(s.overall).toBe(70);
    expect(s.trendValues).toEqual([80, 60]);
  });

  it('treats empty buckets as 0% in the trend', () => {
    const s = summarizePassRate([pt(0, 0), pt(5, 10)]);
    expect(s.trendValues).toEqual([0, 50]);
    expect(s.overall).toBe(50);
  });
});

describe('passRateDelta', () => {
  it('returns null with fewer than two buckets that have cases', () => {
    expect(passRateDelta([])).toBeNull();
    expect(passRateDelta([pt(5, 10)])).toBeNull();
    expect(passRateDelta([pt(5, 10), pt(0, 0)])).toBeNull();
  });

  it('compares first and last buckets that have cases', () => {
    expect(passRateDelta([pt(7, 10), pt(9, 10)])).toBe(20);
    expect(passRateDelta([pt(9, 10), pt(6, 10)])).toBe(-30);
  });

  it('ignores empty buckets at the edges', () => {
    expect(passRateDelta([pt(0, 0), pt(5, 10), pt(8, 10), pt(0, 0)])).toBe(30);
  });
});
