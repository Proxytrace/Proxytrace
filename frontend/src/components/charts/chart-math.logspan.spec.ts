import { describe, it, expect } from 'vitest';
import { logSpanPos } from './chart-math';

describe('logSpanPos', () => {
  it('maps the bounds to 0 and 1', () => {
    expect(logSpanPos(100, 100, 10_000)).toBe(0);
    expect(logSpanPos(10_000, 100, 10_000)).toBe(1);
  });

  it('is log-scaled (geometric midpoint lands at 0.5)', () => {
    expect(logSpanPos(1_000, 100, 10_000)).toBeCloseTo(0.5);
  });

  it('clamps out-of-range and sub-1 values', () => {
    expect(logSpanPos(1, 100, 10_000)).toBe(0);
    expect(logSpanPos(99_999, 100, 10_000)).toBe(1);
    expect(logSpanPos(0, 0, 10_000)).toBe(0);
  });

  it('degenerate lo===hi does not divide by zero', () => {
    expect(Number.isFinite(logSpanPos(500, 500, 500))).toBe(true);
  });
});
