import { describe, it, expect } from 'vitest';
import {
  resolveRange,
  presetWindow,
  formatRangeLabel,
  isRangeActive,
  isoToLocalInput,
  localInputToIso,
  ALL_TIME,
  type TimeRange,
} from './timeRange';

describe('resolveRange', () => {
  const now = Date.UTC(2026, 5, 8, 12, 0, 0); // 2026-06-08T12:00:00Z

  it('returns an empty bound for "all"', () => {
    expect(resolveRange(ALL_TIME, now)).toEqual({});
  });

  it('resolves a preset to a from-instant relative to now, with no upper bound', () => {
    const out = resolveRange({ kind: 'preset', preset: '1h' }, now);
    expect(out.from).toBe(new Date(Date.UTC(2026, 5, 8, 11, 0, 0)).toISOString());
    expect(out.to).toBeUndefined();
  });

  it('subtracts the correct window for a multi-day preset', () => {
    const out = resolveRange({ kind: 'preset', preset: '7d' }, now);
    expect(out.from).toBe(new Date(Date.UTC(2026, 5, 1, 12, 0, 0)).toISOString());
  });

  it('passes through both ends of an absolute range', () => {
    const range: TimeRange = { kind: 'absolute', from: '2026-06-01T00:00:00.000Z', to: '2026-06-08T00:00:00.000Z' };
    expect(resolveRange(range, now)).toEqual({ from: range.from, to: range.to });
  });

  it('omits a null end of an absolute range', () => {
    expect(resolveRange({ kind: 'absolute', from: '2026-06-01T00:00:00.000Z', to: null }, now)).toEqual({
      from: '2026-06-01T00:00:00.000Z',
    });
  });
});

describe('presetWindow', () => {
  const now = Date.UTC(2026, 5, 8, 12, 0, 0); // 2026-06-08T12:00:00Z

  it('spans from (now - window) to now, both concrete', () => {
    const w = presetWindow('1h', now);
    expect(w.from).toBe(new Date(Date.UTC(2026, 5, 8, 11, 0, 0)).toISOString());
    expect(w.to).toBe(new Date(now).toISOString());
  });

  it('uses the full window for a multi-day preset', () => {
    const w = presetWindow('7d', now);
    expect(w.from).toBe(new Date(Date.UTC(2026, 5, 1, 12, 0, 0)).toISOString());
    expect(w.to).toBe(new Date(now).toISOString());
  });
});

describe('isRangeActive', () => {
  it('is false for all-time', () => expect(isRangeActive(ALL_TIME)).toBe(false));
  it('is true for any preset', () => expect(isRangeActive({ kind: 'preset', preset: '24h' })).toBe(true));
  it('is false for an absolute range with no ends set', () =>
    expect(isRangeActive({ kind: 'absolute', from: null, to: null })).toBe(false));
  it('is true for an absolute range with one end set', () =>
    expect(isRangeActive({ kind: 'absolute', from: '2026-06-01T00:00:00.000Z', to: null })).toBe(true));
});

describe('formatRangeLabel', () => {
  it('labels all-time', () => expect(formatRangeLabel(ALL_TIME)).toBe('All time'));
  it('labels a preset with its human name', () =>
    expect(formatRangeLabel({ kind: 'preset', preset: '15m' })).toBe('Last 15 minutes'));
  it('uses "now" for an open upper bound', () =>
    expect(formatRangeLabel({ kind: 'absolute', from: '2026-06-01T10:00:00.000Z', to: null })).toContain('→ now'));
  it('uses "Any" for an open lower bound', () =>
    expect(formatRangeLabel({ kind: 'absolute', from: null, to: '2026-06-01T10:00:00.000Z' })).toMatch(/^Any →/));
  it('renders absolute ends as browser-local dd.MM.yyyy HH:mm', () => {
    // Constructed in local time and read back in local time, so the assertion is TZ-independent.
    const from = new Date(2026, 5, 8, 9, 5).toISOString();
    const to = new Date(2026, 5, 8, 14, 30).toISOString();
    expect(formatRangeLabel({ kind: 'absolute', from, to })).toBe('08.06.2026 09:05 → 08.06.2026 14:30');
  });
});

describe('datetime-local conversion', () => {
  it('round-trips an instant through local input form', () => {
    const iso = '2026-06-08T09:30:00.000Z';
    const back = localInputToIso(isoToLocalInput(iso));
    // Minute precision is preserved; seconds are dropped by the input format.
    expect(back).toBe('2026-06-08T09:30:00.000Z');
  });

  it('maps blank input to null', () => {
    expect(isoToLocalInput(null)).toBe('');
    expect(localInputToIso('')).toBeNull();
  });

  it('returns null for an unparseable input', () => {
    expect(localInputToIso('not-a-date')).toBeNull();
    expect(isoToLocalInput('not-a-date')).toBe('');
  });
});
