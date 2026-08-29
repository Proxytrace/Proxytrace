import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';
import type { LicenseSource, LicenseStatus } from '../../api/license';

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

/** Human-readable label per support-key status. */
export const STATUS_LABELS: Record<LicenseStatus, MessageDescriptor> = {
  free: msg`No support contract`,
  active: msg`Active`,
  grace: msg`Grace period`,
  expired: msg`Expired / revoked`,
  invalid: msg`Invalid`,
};

/**
 * Explains where the active support key came from, for the settings page.
 * Returns null when there is nothing worth explaining (no key at all).
 */
export function licenseSourceNote(source: LicenseSource): MessageDescriptor | null {
  switch (source) {
    case 'environment':
      return msg`This key was supplied via the PROXYTRACE_LICENSE environment variable. A key activated here is stored in the database and takes precedence over it.`;
    case 'stored':
      return msg`This key was activated from the UI and is stored in the database. It survives restarts and takes precedence over an environment-supplied key.`;
    case 'none':
      return null;
  }
}

/**
 * Visual treatment of the support chip. Deliberately distinct from the health ("Online") chip so
 * the two don't read as twins: `premium` is the cyan, crowned marque; `pending` flags a
 * re-validation in progress.
 */
export type TierTone = 'premium' | 'pending';

export interface TierBadge {
  label: MessageDescriptor;
  /** Drives the chip's styling. */
  tone: TierTone;
}

/**
 * Maps the support-key status to the topbar chip. Null when there is nothing to show — an
 * installation without a support contract (or with an invalid key) carries no chip at all, since
 * every feature is available regardless and there is nothing to upgrade to. A valid key shows
 * the cyan "premium" marque when active, or "pending" (amber) while a grace/expired re-validation
 * is in flight.
 */
export function tierBadge(status: LicenseStatus): TierBadge | null {
  if (status === 'free' || status === 'invalid') return null;
  return {
    label: msg`Enterprise support`,
    tone: status === 'active' ? 'premium' : 'pending',
  };
}
