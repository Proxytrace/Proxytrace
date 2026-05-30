import { describe, it, expect } from 'vitest';
import { daysLeft, tierBadge, upgradeCopy } from './licenseUtils';

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
  it('shows a neutral Free pill that links to upgrade', () => {
    expect(tierBadge('free', 'free')).toEqual({
      label: 'Free',
      color: 'var(--text-secondary)',
      linkToUpgrade: true,
    });
  });

  it('shows a green Enterprise pill when active', () => {
    const badge = tierBadge('active', 'enterprise');
    expect(badge.label).toBe('Enterprise');
    expect(badge.color).toBe('var(--success)');
    expect(badge.linkToUpgrade).toBe(false);
  });

  it('shows an amber pill while re-validation is pending', () => {
    expect(tierBadge('grace', 'enterprise').color).toBe('var(--warn)');
    expect(tierBadge('expired', 'enterprise').color).toBe('var(--warn)');
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
