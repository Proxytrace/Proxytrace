import { describe, it, expect } from 'vitest';
import { passRateColor, passRateTextClass } from './suitesMeta';

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

describe('passRateTextClass', () => {
  it('mirrors passRateColor thresholds as Tailwind classes', () => {
    expect(passRateTextClass(null)).toBe('text-muted');
    expect(passRateTextClass(75)).toBe('text-success');
    expect(passRateTextClass(74)).toBe('text-warn');
    expect(passRateTextClass(55)).toBe('text-warn');
    expect(passRateTextClass(54)).toBe('text-danger');
  });
});
