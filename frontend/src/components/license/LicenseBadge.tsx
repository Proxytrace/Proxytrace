import { Link } from 'react-router-dom';
import { CrownIcon, SparklesIcon } from '../icons';
import { cn } from '../../lib/cn';
import { useLicense } from '../../api/license';
import { tierBadge, type TierTone } from './licenseUtils';

// The tier chip sits next to the health ("Online") pill but must NOT read as its
// twin. The health pill owns the "tinted pill + live status dot" language; the
// tier chip instead leads with a tier icon (crown for Enterprise, sparkles for
// Free) and carries no status dot. Geometry matches the health pill so the two
// align, but fill + icon set them apart.
const CHIP_BASE =
  'inline-flex items-center gap-1.5 px-[10px] py-[6px] rounded-full border text-xs font-semibold whitespace-nowrap shrink-0';

const TONE_CLS: Record<TierTone, string> = {
  // Enterprise, active — the gold premium marque: a warm accent gradient,
  // clearly richer than the flat-green health pill.
  premium: cn(
    'text-accent-hover',
    'bg-[image:linear-gradient(135deg,color-mix(in_srgb,var(--accent-primary)_22%,transparent),color-mix(in_srgb,var(--accent-primary)_7%,transparent))]',
    'border-[color-mix(in_srgb,var(--accent-primary)_40%,transparent)]',
  ),
  // Enterprise, grace/expired — amber, flags a re-validation in flight.
  pending: cn(
    'text-warn',
    'bg-[color-mix(in_srgb,var(--warn)_13%,transparent)]',
    'border-[color-mix(in_srgb,var(--warn)_34%,transparent)]',
  ),
  // Free — a muted, dashed ghost chip that brightens toward the accent on hover,
  // reading as an "upgrade" affordance rather than a status.
  free: cn(
    'text-muted bg-transparent border-dashed border-hairline cursor-pointer transition-colors',
    'hover:text-accent-hover hover:bg-accent-subtle',
    'hover:border-[color-mix(in_srgb,var(--accent-primary)_40%,transparent)]',
  ),
};

/**
 * Tier chip shown beside the health pill in the top bar. Always visible: a
 * licensed install shows its crowned tier (gold when active, amber while a
 * re-check is pending), and a Free install shows a muted, sparkle-marked chip
 * that links to the upgrade page so the current tier is always communicated.
 */
export function LicenseBadge() {
  const { data } = useLicense();
  if (!data) return null;

  const badge = tierBadge(data.status, data.tier);
  // Free carries the "upgrade" sparkle; every licensed tier wears the crown.
  const Icon = badge.linkToUpgrade ? SparklesIcon : CrownIcon;

  const chip = (
    <span className={cn(CHIP_BASE, TONE_CLS[badge.tone])}>
      <Icon size={13} aria-hidden />
      {badge.label}
    </span>
  );

  if (badge.linkToUpgrade) {
    return (
      <Link to="/upgrade" data-testid="license-badge" aria-label={`${badge.label} tier — upgrade`}>
        {chip}
      </Link>
    );
  }

  return (
    <span data-testid="license-badge" aria-label={`${badge.label} tier`}>
      {chip}
    </span>
  );
}
