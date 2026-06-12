import { useState } from 'react';
import { useLicense, useRefreshLicense, useRemoveLicense } from '../../../api/license';
import { FEATURE_LABELS, STATUS_LABELS, licenseSourceNote } from '../../../components/license/licenseUtils';
import { LicenseKeyForm } from '../../../components/license/LicenseKeyForm';
import { Button } from '../../../components/ui/Button';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ConfirmDialog } from '../../../components/overlays/ConfirmDialog';
import { AlertTriangleIcon, CrownIcon, ResetIcon, SparklesIcon, TrashIcon } from '../../../components/icons';
import { fmtDate } from '../../../lib/format';
import { SectionHeader } from '../components/SectionHeader';
import { StatusCell } from '../components/StatusCell';

/**
 * Workspace-level license management: shows the active tier/status/source,
 * lets an admin validate + activate a new key without a restart, remove the
 * stored key, or force a re-check against the license server.
 */
export function LicenseSection() {
  const { data: license, isLoading } = useLicense();
  const refresh = useRefreshLicense();
  const remove = useRemoveLicense();
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  if (isLoading || !license) {
    return (
      <div className="w-full min-w-0 flex flex-col" data-testid="settings-license">
        <SectionHeader title="License" subtitle="Manage this installation's license key." />
        <Skeleton height={160} className="max-w-[760px]" />
      </div>
    );
  }

  const isOverride = license.source === 'override';
  const isPaid = license.tier !== 'free';
  const sourceNote = licenseSourceNote(license.source);
  const statusTone =
    license.status === 'active' ? 'text-success'
    : license.status === 'free' ? 'text-secondary'
    : license.status === 'grace' ? 'text-warn'
    : 'text-danger';

  return (
    <div className="w-full min-w-0 flex flex-col" data-testid="settings-license">
      <SectionHeader title="License" subtitle="Manage this installation's license key." />

      <div className="max-w-[760px] flex flex-col gap-5">
        <div className="bg-card-2 border border-hairline rounded-[12px] p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-h2 font-semibold m-0 text-primary flex items-center gap-2">
              {isPaid ? <CrownIcon size={14} className="text-accent" /> : <SparklesIcon size={14} className="text-accent" />}
              Current license
            </h3>
            {isPaid && !isOverride && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<ResetIcon size={13} />}
                loading={refresh.isPending}
                onClick={() => refresh.mutate()}
                data-testid="license-recheck-btn"
              >
                Re-check now
              </Button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StatusCell
              label="Tier"
              value={license.tier === 'enterprise' ? 'Enterprise' : 'Free'}
              testId="license-tier"
            />
            <StatusCell
              label="Status"
              value={STATUS_LABELS[license.status]}
              valueClassName={statusTone}
              testId="license-status"
            />
            <StatusCell
              label="Expires"
              value={license.expiresAt ? fmtDate(license.expiresAt) : '—'}
              testId="license-expires"
            />
          </div>

          {license.customerEmail && (
            <div className="text-body-sm text-secondary">
              Licensed to <span className="text-primary">{license.customerEmail}</span>
            </div>
          )}

          {license.status === 'invalid' && (
            <div className="flex items-start gap-1.5 text-body-sm text-danger" data-testid="license-invalid-note">
              <AlertTriangleIcon size={12} className="mt-0.5 shrink-0" />
              <span>
                The configured license could not be validated
                {license.invalidReason ? ` — ${license.invalidReason}` : ''}. The installation runs
                with Free-tier limits until a valid key is activated.
              </span>
            </div>
          )}

          {sourceNote && <p className="text-body-sm text-muted m-0">{sourceNote}</p>}

          {license.features.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 border-t border-hairline">
              {license.features.map(f => (
                <span key={f} className="text-body-sm text-secondary">{FEATURE_LABELS[f]}</span>
              ))}
            </div>
          )}
        </div>

        {!isOverride && (
          <div className="flex flex-col gap-3">
            <h3 className="text-h2 font-semibold m-0 text-primary">Activate a license key</h3>
            <p className="text-body-sm text-muted m-0">
              Paste the key from your purchase email. It is validated offline, stored in the
              database, and applied immediately — no restart needed. Without a key, Proxytrace
              runs on the Free tier.
            </p>
            <LicenseKeyForm />
          </div>
        )}

        {license.source === 'stored' && (
          <div className="flex items-center gap-2 pt-2 border-t border-hairline">
            <Button
              variant="dangerOutline"
              size="sm"
              leftIcon={<TrashIcon size={13} />}
              loading={remove.isPending}
              onClick={() => setConfirmingRemove(true)}
              data-testid="license-remove-btn"
            >
              Remove stored license
            </Button>
            <span className="text-body-sm text-muted">
              Falls back to the environment-supplied license, or the Free tier.
            </span>
          </div>
        )}
      </div>

      {confirmingRemove && (
        <ConfirmDialog
          title="Remove stored license?"
          message="The installation falls back to the environment-supplied license, or the Free tier. Enterprise features stop working immediately if no other license is configured."
          confirmLabel="Remove license"
          loading={remove.isPending}
          onCancel={() => setConfirmingRemove(false)}
          onConfirm={() => remove.mutate(undefined, { onSuccess: () => setConfirmingRemove(false) })}
        />
      )}
    </div>
  );
}
