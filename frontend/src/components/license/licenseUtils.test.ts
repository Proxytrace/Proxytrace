import { beforeAll, describe, it, expect } from 'vitest';
import { i18n } from '../../i18n';
import { daysLeft, licenseSourceNote, tierBadge } from './licenseUtils';

// Activate an empty catalog so i18n._() resolves MessageDescriptors to their source strings.
beforeAll(() => i18n.loadAndActivate({ locale: 'en', messages: {} }));

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

describe('tierBadge', () => {
  it('shows no chip without a support contract', () => {
    expect(tierBadge('free')).toBeNull();
  });

  it('shows no chip while the configured key is invalid', () => {
    expect(tierBadge('invalid')).toBeNull();
  });

  it('shows the cyan premium chip for an active support contract', () => {
    const badge = tierBadge('active');
    expect(badge).not.toBeNull();
    expect(i18n._(badge?.label ?? msgFallback)).toBe('Enterprise support');
    expect(badge?.tone).toBe('premium');
  });

  it('shows a pending (amber) chip while re-validation is in flight', () => {
    expect(tierBadge('grace')?.tone).toBe('pending');
    expect(tierBadge('expired')?.tone).toBe('pending');
  });
});

describe('licenseSourceNote', () => {
  it('explains environment and stored sources', () => {
    const note = (source: Parameters<typeof licenseSourceNote>[0]) => {
      const descriptor = licenseSourceNote(source);
      return descriptor ? i18n._(descriptor) : null;
    };
    expect(note('environment')).toContain('PROXYTRACE_LICENSE');
    expect(note('stored')).toContain('stored in the database');
  });

  it('returns null when no key is configured', () => {
    expect(licenseSourceNote('none')).toBeNull();
  });
});

// A descriptor that never matches, so a null badge fails the assertion loudly instead of passing.
const msgFallback = { id: 'test.fallback', message: '<no badge>' };
