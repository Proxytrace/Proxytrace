import { useState } from 'react';
import { Trans } from '@lingui/react/macro';
import { useLicense } from '../../../hooks/useLicense';
import { LicenseKeyForm } from '../../../components/license/LicenseKeyForm';
import { Button } from '../../../components/ui/Button';
import { AlertTriangleIcon, KeyIcon } from '../../../components/icons';

/**
 * The Welcome step's license affordance: a quiet "Have a license key?" reveal
 * for Free installs, expanded automatically (with the rejection reason) when a
 * configured license failed validation. Hidden for kiosk/override deployments
 * and once a healthy paid license is active.
 */
export function WelcomeLicenseEntry() {
  const { data: license } = useLicense();
  const [open, setOpen] = useState(false);

  if (!license || license.source === 'override') return null;

  const invalid = license.status === 'invalid';
  if (license.tier !== 'free' && !invalid) return null;

  return (
    <div className="flex flex-col gap-2" data-testid="setup-welcome-license">
      {invalid && (
        <div className="flex items-start gap-1.5 text-body-sm text-danger" data-testid="setup-welcome-license-invalid">
          <AlertTriangleIcon size={12} className="mt-0.5 shrink-0" />
          <span>
            <Trans>The configured license could not be validated</Trans>
            {license.invalidReason ? ` — ${license.invalidReason}` : ''}
            <Trans>. Paste a valid key below, or continue on the Free tier.</Trans>
          </span>
        </div>
      )}

      {open || invalid ? (
        <LicenseKeyForm />
      ) : (
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<KeyIcon size={13} />}
          onClick={() => setOpen(true)}
          className="self-start"
          data-testid="setup-welcome-license-toggle"
        >
          <Trans>Have a license key?</Trans>
        </Button>
      )}
    </div>
  );
}
