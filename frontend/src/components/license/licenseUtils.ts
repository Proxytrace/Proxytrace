import type { UpgradeErrorType } from '../../api/client';
import type { LicenseStatus, LicenseTier } from '../../api/license';

/**
 * Whole days remaining until `endsAt`, never negative. Returns 0 when the date
 * is missing, unparseable, or already in the past. `now` is injectable for tests.
 */
export function daysLeft(endsAt: string | null | undefined, now: number = Date.now()): number {
  if (!endsAt) return 0;
  const end = Date.parse(endsAt);
  if (Number.isNaN(end)) return 0;
  const diffMs = end - now;
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

/** Human-readable label per tier. */
const TIER_LABEL: Record<LicenseTier, string> = { free: 'Free', enterprise: 'Enterprise' };

export interface TierBadge {
  label: string;
  /** A CSS color (token reference) for the tinted pill. */
  color: string;
  /** Whether the badge should link to the upgrade page (Free only). */
  linkToUpgrade: boolean;
}

/**
 * Maps the license status/tier to the topbar pill's label, tint color, and
 * whether it doubles as an upgrade affordance. Free is always shown (neutral
 * tint, links to upgrade); licensed installs are green (active) or amber
 * (grace/expired, re-validation pending).
 */
export function tierBadge(status: LicenseStatus, tier: LicenseTier): TierBadge {
  if (status === 'free') {
    return { label: TIER_LABEL.free, color: 'var(--text-secondary)', linkToUpgrade: true };
  }
  return {
    label: TIER_LABEL[tier],
    color: status === 'active' ? 'var(--success)' : 'var(--warn)',
    linkToUpgrade: false,
  };
}

export interface UpgradeCopy {
  title: string;
  /** Fallback body when the server did not supply a specific message. */
  fallback: string;
}

/**
 * The headline + fallback body for the upgrade dialog, keyed on the 402 error
 * type. The server's own message (when present) is shown verbatim; this only
 * frames it and covers the case where no message came back.
 */
export function upgradeCopy(errorType: UpgradeErrorType): UpgradeCopy {
  if (errorType === 'LicenseLimitExceeded') {
    return {
      title: "You've reached a Free-tier limit",
      fallback:
        'This action exceeds a usage limit of your current license tier. Upgrade to Enterprise for unlimited projects, agents, users, and test suites.',
    };
  }
  return {
    title: 'This is an Enterprise feature',
    fallback:
      'This feature is part of the Proxytrace Enterprise tier. Upgrade your license to unlock it.',
  };
}
