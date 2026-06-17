import { describe, expect, it } from 'vitest';
import {
  formatInterval,
  fromIntervalMinutes,
  toIntervalMinutes,
} from './interval';

describe('formatInterval', () => {
  it('uses minutes for sub-hour and non-whole-hour intervals', () => {
    expect(formatInterval(30)).toBe('Every 30m');
    expect(formatInterval(90)).toBe('Every 90m');
    expect(formatInterval(1)).toBe('Every 1m');
  });

  it('uses hours for whole-hour intervals under a day', () => {
    expect(formatInterval(60)).toBe('Every 1h');
    expect(formatInterval(120)).toBe('Every 2h');
    expect(formatInterval(720)).toBe('Every 12h');
  });

  it('uses days for whole-day intervals', () => {
    expect(formatInterval(1440)).toBe('Every 1d');
    expect(formatInterval(2880)).toBe('Every 2d');
  });

  it('guards against non-positive intervals', () => {
    expect(formatInterval(0)).toBe('Every —');
    expect(formatInterval(-5)).toBe('Every —');
  });
});

describe('toIntervalMinutes', () => {
  it('multiplies by the unit', () => {
    expect(toIntervalMinutes(30, 'minutes')).toBe(30);
    expect(toIntervalMinutes(2, 'hours')).toBe(120);
    expect(toIntervalMinutes(3, 'days')).toBe(4320);
  });
});

describe('fromIntervalMinutes', () => {
  it('is the inverse, picking the largest whole unit', () => {
    expect(fromIntervalMinutes(1440)).toEqual({ value: 1, unit: 'days' });
    expect(fromIntervalMinutes(120)).toEqual({ value: 2, unit: 'hours' });
    expect(fromIntervalMinutes(90)).toEqual({ value: 90, unit: 'minutes' });
  });

  it('round-trips with toIntervalMinutes', () => {
    for (const m of [15, 30, 60, 90, 120, 1440, 2880]) {
      const { value, unit } = fromIntervalMinutes(m);
      expect(toIntervalMinutes(value, unit)).toBe(m);
    }
  });
});
