import { describe, it, expect } from 'vitest';
import { daysLeft } from './licenseUtils';

const NOW = Date.parse('2026-05-29T00:00:00Z');

describe('daysLeft', () => {
  it('returns 0 for null/undefined/empty', () => {
    expect(daysLeft(null, NOW)).toBe(0);
    expect(daysLeft(undefined, NOW)).toBe(0);
    expect(daysLeft('', NOW)).toBe(0);
  });

  it('returns 0 for an unparseable date', () => {
    expect(daysLeft('not-a-date', NOW)).toBe(0);
  });

  it('returns 0 for a past date', () => {
    expect(daysLeft('2026-05-28T00:00:00Z', NOW)).toBe(0);
  });

  it('rounds partial days up', () => {
    expect(daysLeft('2026-05-30T12:00:00Z', NOW)).toBe(2);
  });

  it('counts whole days remaining', () => {
    expect(daysLeft('2026-06-05T00:00:00Z', NOW)).toBe(7);
  });
});
