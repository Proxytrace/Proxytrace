import { describe, it, expect } from 'vitest';
import { daysLeft, licenseSourceNote, tierBadge, upgradeCopy } from './licenseUtils';

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
    expect(tierBadge('free', 'free')).toEqual({
      label: 'Free',
      tone: 'free',
      linkToUpgrade: true,
    });
  });

  it('shows the gold premium Enterprise chip when active', () => {
    const badge = tierBadge('active', 'enterprise');
    expect(badge.label).toBe('Enterprise');
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
    expect(upgradeCopy('LicenseLimitExceeded').title).toBe("You've reached a Free-tier limit");
    expect(upgradeCopy('FeatureNotLicensed').title).toBe('This is an Enterprise feature');
  });

  it('provides a fallback body for each error type', () => {
    expect(upgradeCopy('LicenseLimitExceeded').fallback).toBeTruthy();
    expect(upgradeCopy('FeatureNotLicensed').fallback).toBeTruthy();
  });
});

describe('invalid license', () => {
  it('shows the Free upgrade chip while the configured license is invalid', () => {
    expect(tierBadge('invalid', 'free')).toEqual({
      label: 'Free',
      tone: 'free',
      linkToUpgrade: true,
    });
  });
});

describe('licenseSourceNote', () => {
  it('explains environment, stored, and override sources', () => {
    expect(licenseSourceNote('environment')).toContain('PROXYTRACE_LICENSE');
    expect(licenseSourceNote('stored')).toContain('stored in the database');
    expect(licenseSourceNote('override')).toContain('cannot be changed');
  });

  it('returns null when no license is configured', () => {
    expect(licenseSourceNote('none')).toBeNull();
  });
});
