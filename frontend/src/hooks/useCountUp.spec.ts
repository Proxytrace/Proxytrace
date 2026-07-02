import { describe, it, expect } from 'vitest';
import { easeOutCubic, countUpValue } from './useCountUp';

describe('easeOutCubic', () => {
  it('pins the endpoints', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });

  it('front-loads progress (fast start, gentle settle)', () => {
    // At the midpoint an ease-out is already well past halfway.
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});

describe('countUpValue', () => {
  it('returns the start at p<=0 and the target at p>=1', () => {
    expect(countUpValue(0, 100, 0)).toBe(0);
    expect(countUpValue(0, 100, 1)).toBe(100);
  });

  it('clamps out-of-range progress to the endpoints', () => {
    expect(countUpValue(0, 100, -5)).toBe(0);
    expect(countUpValue(0, 100, 5)).toBe(100);
  });

  it('lands exactly on the target regardless of the starting value', () => {
    expect(countUpValue(37, 1_400_000, 1)).toBe(1_400_000);
    expect(countUpValue(1_400_000, 12, 1)).toBe(12);
  });

  it('tweens monotonically between two frames', () => {
    const a = countUpValue(0, 100, 0.25);
    const b = countUpValue(0, 100, 0.5);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(b).toBeLessThan(100);
  });
});
