import { Link } from 'react-router-dom';
import { Badge } from '../ui/Badge';
import { SparklesIcon } from '../icons';
import { useLicense } from '../../api/license';
import { tierBadge } from './licenseUtils';

// Match the dimensions of the neighbouring health ("Online") chip so the two
// pills read as a set: same padding and text size.
const CHIP_CLS = 'px-[10px] py-[6px] text-xs';

/**
 * Tier pill shown beside the health pill in the top bar. Always visible: a
 * licensed install shows its tier (green when active, amber while a re-check is
 * pending), and a Free install shows a neutral "Free" pill that links to the
 * upgrade page so the current tier is always communicated.
 */
export function LicenseBadge() {
  const { data } = useLicense();
  if (!data) return null;

  const badge = tierBadge(data.status, data.tier);

  // Free: a sparkles hint icon signals "upgrade" (the pill links to /upgrade).
  // Licensed: a status dot, matching the neighbouring health chip.
  if (badge.linkToUpgrade) {
    const label = (
      <>
        <SparklesIcon size={11} aria-hidden />
        {badge.label}
      </>
    );
    return (
      <Link to="/upgrade" data-testid="license-badge" aria-label={`${badge.label} tier — upgrade`}>
        <Badge label={label} variant="tinted" color={badge.color} size="md" className={CHIP_CLS} />
      </Link>
    );
  }

  return (
    <span data-testid="license-badge">
      <Badge label={badge.label} variant="tinted" color={badge.color} dot size="md" className={CHIP_CLS} />
    </span>
  );
}
