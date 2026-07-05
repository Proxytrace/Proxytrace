import type { ReactNode } from 'react';
import { useFeature } from '../../hooks/useLicense';
import type { LicenseFeature } from '../../api/license';
import { UpgradePlaceholder } from './UpgradePlaceholder';

/**
 * Renders its children only when the current license grants the given feature;
 * otherwise shows the full-page upgrade placeholder. Use to gate a whole route
 * or a major section behind an Enterprise feature.
 */
export function RequiresFeature({ feature, children }: { feature: LicenseFeature; children: ReactNode }) {
  const enabled = useFeature(feature);
  if (!enabled) return <UpgradePlaceholder />;
  return <>{children}</>;
}
