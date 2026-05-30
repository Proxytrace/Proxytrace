import { Link } from 'react-router-dom';
import { Pill } from '../ui/Pill';
import { useLicense } from '../../api/license';
import { tierBadge } from './licenseUtils';

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
  const pill = <Pill label={badge.label} color={badge.color} size="sm" />;

  if (badge.linkToUpgrade) {
    return (
      <Link to="/upgrade" data-testid="license-badge" aria-label={`${badge.label} tier — upgrade`}>
        {pill}
      </Link>
    );
  }

  return <span data-testid="license-badge">{pill}</span>;
}
