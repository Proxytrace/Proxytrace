import type { UpgradeErrorType } from '../../api/client';
import type { LicenseFeature, LicenseSource, LicenseStatus, LicenseTier } from '../../api/license';

/** Human-readable label per license feature flag. */
export const FEATURE_LABELS: Record<LicenseFeature, string> = {
  OptimizationProposals: 'Optimization proposals',
  AgenticEvaluators: 'Agentic evaluators',
  CustomEvaluators: 'Custom evaluators',
  SsoOidc: 'SSO / OIDC sign-in',
  AuditLog: 'Audit log',
};

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

/** Human-readable label per license status. */
export const STATUS_LABELS: Record<LicenseStatus, string> = {
  free: 'Free tier',
  active: 'Active',
  grace: 'Grace period',
  expired: 'Expired / revoked',
  invalid: 'Invalid',
};

/**
 * Explains where the active license came from, for the settings License page.
 * Returns null when there is nothing worth explaining (no license at all).
 */
export function licenseSourceNote(source: LicenseSource): string | null {
  switch (source) {
    case 'environment':
      return 'This license was supplied via the PROXYTRACE_LICENSE environment variable. A key activated here is stored in the database and takes precedence over it.';
    case 'stored':
      return 'This license was activated from the UI and is stored in the database. It survives restarts and takes precedence over an environment-supplied license.';
    case 'override':
      return 'The license is fixed by this deployment (demo mode) and cannot be changed here.';
    case 'none':
      return null;
  }
}

/**
 * Visual treatment of the tier chip. Deliberately distinct from the health
 * ("Online") pill so the two don't read as twins: `premium` is the gold,
 * crowned Enterprise marque; `pending` flags a re-validation in progress;
 * `free` is a muted upgrade affordance.
 */
export type TierTone = 'premium' | 'pending' | 'free';

export interface TierBadge {
  label: string;
  /** Drives the chip's styling and which icon it carries. */
  tone: TierTone;
  /** Whether the badge should link to the upgrade page (Free only). */
  linkToUpgrade: boolean;
}

/**
 * Maps the license status/tier to the topbar tier chip's label, visual tone,
 * and whether it doubles as an upgrade affordance. Free is always shown (muted,
 * links to upgrade); a licensed install is the gold "premium" marque when
 * active, or "pending" (amber) while grace/expired re-validation is in flight.
 */
export function tierBadge(status: LicenseStatus, tier: LicenseTier): TierBadge {
  // An invalid configured license runs with Free entitlements — the chip mirrors that;
  // the dedicated invalid-license banner carries the warning.
  if (status === 'free' || status === 'invalid') {
    return { label: TIER_LABEL.free, tone: 'free', linkToUpgrade: true };
  }
  return {
    label: TIER_LABEL[tier],
    tone: status === 'active' ? 'premium' : 'pending',
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
