import { beforeAll, describe, it, expect } from 'vitest';
import { i18n } from '../../i18n';
import { daysLeft, licenseSourceNote, tierBadge, upgradeCopy } from './licenseUtils';

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
  it('shows a muted Free chip that links to upgrade', () => {
    const badge = tierBadge('free', 'free');
    expect(i18n._(badge.label)).toBe('Free');
    expect(badge.tone).toBe('free');
    expect(badge.linkToUpgrade).toBe(true);
  });

  it('shows the gold premium Enterprise chip when active', () => {
    const badge = tierBadge('active', 'enterprise');
    expect(i18n._(badge.label)).toBe('Enterprise');
    expect(badge.tone).toBe('premium');
    expect(badge.linkToUpgrade).toBe(false);
  });

  it('shows a pending (amber) chip while re-validation is in flight', () => {
    expect(tierBadge('grace', 'enterprise').tone).toBe('pending');
    expect(tierBadge('expired', 'enterprise').tone).toBe('pending');
  });
});

describe('upgradeCopy', () => {
  it('frames a limit hit distinctly from a feature gate', () => {
    expect(i18n._(upgradeCopy('LicenseLimitExceeded').title)).toBe("You've reached a Free-tier limit");
    expect(i18n._(upgradeCopy('FeatureNotLicensed').title)).toBe('This is an Enterprise feature');
  });

  it('provides a fallback body for each error type', () => {
    expect(i18n._(upgradeCopy('LicenseLimitExceeded').fallback)).toBeTruthy();
    expect(i18n._(upgradeCopy('FeatureNotLicensed').fallback)).toBeTruthy();
  });
});

describe('invalid license', () => {
  it('shows the Free upgrade chip while the configured license is invalid', () => {
    const badge = tierBadge('invalid', 'free');
    expect(i18n._(badge.label)).toBe('Free');
    expect(badge.tone).toBe('free');
    expect(badge.linkToUpgrade).toBe(true);
  });
});

describe('licenseSourceNote', () => {
  it('explains environment, stored, and override sources', () => {
    const note = (source: Parameters<typeof licenseSourceNote>[0]) => {
      const descriptor = licenseSourceNote(source);
      return descriptor ? i18n._(descriptor) : null;
    };
    expect(note('environment')).toContain('PROXYTRACE_LICENSE');
    expect(note('stored')).toContain('stored in the database');
    expect(note('override')).toContain('cannot be changed');
  });

  it('returns null when no license is configured', () => {
    expect(licenseSourceNote('none')).toBeNull();
  });
});
