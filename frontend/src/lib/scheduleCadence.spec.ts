import { describe, it, expect } from 'vitest';
import {
  cadenceIntervalMinutes,
  cadenceAnchor,
  cadenceToSchedule,
  scheduleToCadence,
  computeNextRun,
  initialCadence,
  HOURLY_MINUTES,
  DAILY_MINUTES,
  WEEKLY_MINUTES,
  type CadenceState,
} from './scheduleCadence';

// Thursday 2026-06-18 14:30 UTC.
const NOW = new Date('2026-06-18T14:30:00.000Z');

function cadence(overrides: Partial<CadenceState>): CadenceState {
  return { ...initialCadence(), ...overrides };
}

describe('cadenceIntervalMinutes', () => {
  it('maps each named frequency to its minutes', () => {
    expect(cadenceIntervalMinutes(cadence({ frequency: 'hourly' }))).toBe(HOURLY_MINUTES);
    expect(cadenceIntervalMinutes(cadence({ frequency: 'daily' }))).toBe(DAILY_MINUTES);
    expect(cadenceIntervalMinutes(cadence({ frequency: 'weekly' }))).toBe(WEEKLY_MINUTES);
  });

  it('multiplies value × unit for custom', () => {
    expect(cadenceIntervalMinutes(cadence({ frequency: 'custom', customValue: 2, customUnit: 'hours' }))).toBe(120);
    expect(cadenceIntervalMinutes(cadence({ frequency: 'custom', customValue: 3, customUnit: 'days' }))).toBe(4320);
  });
});

describe('cadenceAnchor', () => {
  it('daily picks today at the time when it is still ahead', () => {
    const a = cadenceAnchor(cadence({ frequency: 'daily', time: '20:00' }), NOW);
    expect(a.toISOString()).toBe('2026-06-18T20:00:00.000Z');
  });

  it('daily rolls to tomorrow when the time has passed', () => {
    const a = cadenceAnchor(cadence({ frequency: 'daily', time: '02:00' }), NOW);
    expect(a.toISOString()).toBe('2026-06-19T02:00:00.000Z');
  });

  it('hourly picks the next matching minute-of-hour', () => {
    expect(cadenceAnchor(cadence({ frequency: 'hourly', minute: 45 }), NOW).toISOString())
      .toBe('2026-06-18T14:45:00.000Z');
    expect(cadenceAnchor(cadence({ frequency: 'hourly', minute: 15 }), NOW).toISOString())
      .toBe('2026-06-18T15:15:00.000Z');
  });

  it('weekly picks the next matching weekday at the time (UTC)', () => {
    const a = cadenceAnchor(cadence({ frequency: 'weekly', weekday: 1, time: '02:00' }), NOW);
    expect(a.getUTCDay()).toBe(1); // Monday
    expect(a.getUTCHours()).toBe(2);
    expect(a.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it('custom anchors to now (first run one interval out)', () => {
    const a = cadenceAnchor(cadence({ frequency: 'custom' }), NOW);
    expect(a.getTime()).toBe(NOW.getTime());
  });
});

describe('scheduleToCadence ↔ cadenceToSchedule round-trip', () => {
  it('daily', () => {
    const { intervalMinutes, anchorAt } = cadenceToSchedule(cadence({ frequency: 'daily', time: '02:00' }), NOW);
    expect(intervalMinutes).toBe(DAILY_MINUTES);
    const back = scheduleToCadence(intervalMinutes, anchorAt);
    expect(back.frequency).toBe('daily');
    expect(back.time).toBe('02:00');
  });

  it('hourly', () => {
    const { intervalMinutes, anchorAt } = cadenceToSchedule(cadence({ frequency: 'hourly', minute: 30 }), NOW);
    const back = scheduleToCadence(intervalMinutes, anchorAt);
    expect(back.frequency).toBe('hourly');
    expect(back.minute).toBe(30);
  });

  it('weekly', () => {
    const { intervalMinutes, anchorAt } = cadenceToSchedule(cadence({ frequency: 'weekly', weekday: 1, time: '02:00' }), NOW);
    const back = scheduleToCadence(intervalMinutes, anchorAt);
    expect(back.frequency).toBe('weekly');
    expect(back.weekday).toBe(1);
    expect(back.time).toBe('02:00');
  });

  it('custom decomposes the interval', () => {
    const back = scheduleToCadence(120, NOW.toISOString());
    expect(back.frequency).toBe('custom');
    expect(back.customValue).toBe(2);
    expect(back.customUnit).toBe('hours');
  });
});

describe('computeNextRun (mirrors the backend AlignForward)', () => {
  it('returns the anchor when it is in the future', () => {
    const anchor = '2026-06-18T20:00:00.000Z';
    expect(computeNextRun(anchor, DAILY_MINUTES, NOW)?.toISOString()).toBe(anchor);
  });

  it('advances a past anchor forward, preserving the time-of-day', () => {
    // Anchor two days ago at 02:00; daily cadence → next 02:00 strictly after now.
    const next = computeNextRun('2026-06-16T02:00:00.000Z', DAILY_MINUTES, NOW);
    expect(next?.toISOString()).toBe('2026-06-19T02:00:00.000Z');
  });

  it('custom: first run is exactly one interval from the anchor (now)', () => {
    const next = computeNextRun(NOW.toISOString(), 120, NOW);
    expect(next?.toISOString()).toBe('2026-06-18T16:30:00.000Z');
  });

  it('returns null on invalid input', () => {
    expect(computeNextRun('not-a-date', DAILY_MINUTES, NOW)).toBeNull();
    expect(computeNextRun(NOW.toISOString(), 0, NOW)).toBeNull();
  });
});
