import { Link } from 'react-router-dom';
import { useLicense } from '../../api/license';
import { AlertTriangleIcon } from '../icons';

/**
 * Slim warning bar pinned above the top bar when a configured license failed
 * validation. The install keeps running with Free-tier entitlements; admins
 * fix the key on the settings License page.
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
        The configured license is invalid — running with Free-tier limits.
        {data.invalidReason ? ` (${data.invalidReason})` : ''}
      </span>
      <Link to="/settings/license" className="ml-auto underline underline-offset-2 hover:text-primary">
        Fix license
      </Link>
    </div>
  );
}
