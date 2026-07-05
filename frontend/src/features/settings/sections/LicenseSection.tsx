import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useLicense, useRefreshLicense, useRemoveLicense } from '../../../hooks/useLicense';
import { FEATURE_LABELS, STATUS_LABELS, licenseSourceNote } from '../../../components/license/licenseUtils';
import { LicenseKeyForm } from '../../../components/license/LicenseKeyForm';
import { Button } from '../../../components/ui/Button';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ConfirmDialog } from '../../../components/overlays/ConfirmDialog';
import { AlertTriangleIcon, CrownIcon, ResetIcon, ServerIcon, SparklesIcon, TrashIcon } from '../../../components/icons';
import { fmtDate } from '../../../lib/format';
import { cn } from '../../../lib/cn';
import { SectionHeader } from '../components/SectionHeader';
import { StatusCell } from '../components/StatusCell';

/**
 * Workspace-level license management: shows the active tier/status/source,
 * lets an admin validate + activate a new key without a restart, remove the
 * stored key, or force a re-check against the license server.
 */
export function LicenseSection() {
  const { t, i18n } = useLingui();
  const { data: license, isLoading } = useLicense();
  const refresh = useRefreshLicense();
  const remove = useRemoveLicense();
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  if (isLoading || !license) {
    return (
      <div className="w-full min-w-0 flex flex-col" data-testid="settings-license">
        <SectionHeader title={t`License`} subtitle={t`Manage this installation's license key.`} />
        <Skeleton height={160} className="max-w-[760px]" />
      </div>
    );
  }

  const isOverride = license.source === 'override';
  const isPaid = license.tier !== 'free';
  const sourceNote = licenseSourceNote(license.source);
  const statusTone =
    license.status === 'active' ? cn('text-success')
    : license.status === 'free' ? cn('text-secondary')
    : license.status === 'grace' ? cn('text-warn')
    : cn('text-danger');

  return (
    <div className="w-full min-w-0 flex flex-col" data-testid="settings-license">
      <SectionHeader title={t`License`} subtitle={t`Manage this installation's license key.`} />

      <div className="max-w-[760px] flex flex-col gap-5">
        <div className="bg-card-2 border border-hairline rounded-lg p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-h2 font-semibold m-0 text-primary flex items-center gap-2">
              {isPaid ? <CrownIcon size={14} className="text-accent" /> : <SparklesIcon size={14} className="text-accent" />}
              <Trans>Current license</Trans>
            </h3>
            {isPaid && !isOverride && !license.offline && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<ResetIcon size={13} />}
                loading={refresh.isPending}
                onClick={() => refresh.mutate()}
                data-testid="license-recheck-btn"
              >
                <Trans>Re-check now</Trans>
              </Button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StatusCell
              label={t`Tier`}
              value={license.tier === 'enterprise' ? t`Enterprise` : t`Free`}
              testId="license-tier"
            />
            <StatusCell
              label={t`Status`}
              value={i18n._(STATUS_LABELS[license.status])}
              valueClassName={statusTone}
              testId="license-status"
            />
            <StatusCell
              label={t`Expires`}
              value={license.expiresAt ? fmtDate(license.expiresAt) : '—'}
              testId="license-expires"
            />
          </div>

          {license.customerEmail && (
            <div className="text-body-sm text-secondary">
              <Trans>Licensed to <span className="text-primary">{license.customerEmail}</span></Trans>
            </div>
          )}

          {license.status === 'invalid' && (
            <div className="flex items-start gap-1.5 text-body-sm text-danger" data-testid="license-invalid-note">
              <AlertTriangleIcon size={12} className="mt-0.5 shrink-0" />
              <span>
                <Trans>
                  The configured license could not be validated
                  {license.invalidReason ? ` — ${license.invalidReason}` : ''}. The installation runs
                  with Free-tier limits until a valid key is activated.
                </Trans>
              </span>
            </div>
          )}

          {license.offline && (
            <div className="flex items-start gap-1.5 text-body-sm text-secondary" data-testid="license-offline-note">
              <ServerIcon size={12} className="mt-0.5 shrink-0 text-teal" />
              <span>
                <Trans>
                  This is an offline license. It is never re-validated against the license server, so
                  it keeps working with no outbound connection — only its expiry ends it.
                </Trans>
              </span>
            </div>
          )}

          {sourceNote && <p className="text-body-sm text-muted m-0">{i18n._(sourceNote)}</p>}

          {license.features.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 border-t border-hairline">
              {license.features.map(f => (
                <span key={f} className="text-body-sm text-secondary">{i18n._(FEATURE_LABELS[f])}</span>
              ))}
            </div>
          )}
        </div>

        {!isOverride && (
          <div className="flex flex-col gap-3">
            <h3 className="text-h2 font-semibold m-0 text-primary"><Trans>Activate a license key</Trans></h3>
            <p className="text-body-sm text-muted m-0">
              <Trans>
                Paste the key from your purchase email. It is validated offline, stored in the
                database, and applied immediately — no restart needed. Without a key, Proxytrace
                runs on the Free tier.
              </Trans>
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
              <Trans>Remove stored license</Trans>
            </Button>
            <span className="text-body-sm text-muted">
              <Trans>Falls back to the environment-supplied license, or the Free tier.</Trans>
            </span>
          </div>
        )}
      </div>

      {confirmingRemove && (
        <ConfirmDialog
          title={t`Remove stored license?`}
          message={t`The installation falls back to the environment-supplied license, or the Free tier. Enterprise features stop working immediately if no other license is configured.`}
          confirmLabel={t`Remove license`}
          loading={remove.isPending}
          onCancel={() => setConfirmingRemove(false)}
          onConfirm={() => remove.mutate(undefined, { onSuccess: () => setConfirmingRemove(false) })}
        />
      )}
    </div>
  );
}
