import type { LicenseFeature } from '../../api/license';

/** Decides whether a nav entry's required feature is satisfied by the current license. */
export function isNavEntryLocked(
  requiresFeature: LicenseFeature | undefined,
  enabledFeatures: readonly LicenseFeature[],
): boolean {
  if (!requiresFeature) return false;
  return !enabledFeatures.includes(requiresFeature);
}
