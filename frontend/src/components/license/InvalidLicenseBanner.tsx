import { Link } from 'react-router';
import { Trans } from '@lingui/react/macro';
import { useLicense } from '../../hooks/useLicense';
import { AlertTriangleIcon } from '../icons';

/**
 * Slim warning bar pinned above the top bar when a configured support key failed validation.
 * Nothing is gated on it, so the install runs unaffected; admins fix the key on the settings
 * page so the support contract is recorded correctly.
 */
export function InvalidLicenseBanner() {
  const { data } = useLicense();
  if (!data || data.status !== 'invalid') return null;

  return (
    <div
      data-testid="license-invalid-banner"
      role="status"
      className="shrink-0 flex items-center gap-2 px-4 py-1.5 text-body-sm font-medium text-danger bg-danger-subtle border-b border-[color-mix(in_srgb,var(--danger)_25%,transparent)]"
    >
      <AlertTriangleIcon size={14} />
      <span>
        <Trans>The configured Enterprise support key is invalid.</Trans>
        {data.invalidReason ? ` (${data.invalidReason})` : ''}
      </span>
      <Link to="/settings/license" className="ml-auto underline underline-offset-2 hover:text-primary">
        <Trans>Fix key</Trans>
      </Link>
    </div>
  );
}
