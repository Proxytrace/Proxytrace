import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fmtRelative, fmtUntil } from './format';

const NOW = new Date('2026-06-17T12:00:00.000Z').getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

/** ISO string for a timestamp `offsetMs` away from the frozen `NOW` (positive = future). */
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('fmtRelative', () => {
  it('formats past timestamps with unit thresholds', () => {
    expect(fmtRelative(at(-30 * SECOND))).toBe('30s ago');
    expect(fmtRelative(at(-5 * MINUTE))).toBe('5m ago');
    expect(fmtRelative(at(-3 * HOUR))).toBe('3h ago');
    expect(fmtRelative(at(-2 * DAY))).toBe('2d ago');
  });

  it('falls back to an absolute date beyond a week', () => {
    expect(fmtRelative(at(-10 * DAY))).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
  });
});

describe('fmtUntil', () => {
  it('formats future timestamps with unit thresholds', () => {
    expect(fmtUntil(at(30 * SECOND))).toBe('in 30s');
    expect(fmtUntil(at(5 * MINUTE))).toBe('in 5m');
    expect(fmtUntil(at(59 * MINUTE))).toBe('in 59m');
    expect(fmtUntil(at(2 * HOUR))).toBe('in 2h');
    expect(fmtUntil(at(3 * DAY))).toBe('in 3d');
  });

  it('reports "due" for past or current timestamps', () => {
    expect(fmtUntil(at(0))).toBe('due');
    expect(fmtUntil(at(-1 * HOUR))).toBe('due');
  });

  it('falls back to an absolute date beyond a week out', () => {
    expect(fmtUntil(at(10 * DAY))).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
  });
});
