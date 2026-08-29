import { useLingui } from '@lingui/react/macro';
import { CrownIcon } from '../icons';
import { cn } from '../../lib/cn';
import { useLicense } from '../../hooks/useLicense';
import { tierBadge, type TierTone } from './licenseUtils';

// The support chip sits next to the health ("Online") chip but must NOT read as its twin. The
// health chip owns the "tinted fill + live status dot" language; this chip instead leads with a
// crown and carries no status dot. Geometry matches the health chip so the two align, but fill +
// icon set them apart.
const CHIP_BASE = cn(
  'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-none border text-body-sm font-semibold whitespace-nowrap shrink-0',
);

const TONE_CLS: Record<TierTone, string> = {
  // Active support contract — the premium marque: a flat cyan-tinted fill.
  premium: cn(
    'text-accent-hover',
    'bg-accent-subtle',
    'border-[color-mix(in_srgb,var(--accent-primary)_40%,transparent)]',
  ),
  // Grace/expired — amber, flags a re-validation in flight.
  pending: cn(
    'text-warn',
    'bg-[color-mix(in_srgb,var(--warn)_13%,transparent)]',
    'border-[color-mix(in_srgb,var(--warn)_34%,transparent)]',
  ),
};

/**
 * Support chip shown beside the health chip in the top bar. Rendered only when an Enterprise
 * support key is on file (cyan when active, amber while a re-check is pending); an installation
 * without one shows nothing — every feature is available either way.
 */
export function LicenseBadge() {
  const { t, i18n } = useLingui();
  const { data } = useLicense();
  if (!data) return null;

  const badge = tierBadge(data.status);
  if (!badge) return null;
  const label = i18n._(badge.label);

  return (
    <span data-testid="license-badge" aria-label={t`${label} — active`}>
      <span className={cn(CHIP_BASE, TONE_CLS[badge.tone])}>
        <CrownIcon size={13} aria-hidden />
        {label}
      </span>
    </span>
  );
}
