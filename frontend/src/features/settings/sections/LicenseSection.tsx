import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useLicense, useRefreshLicense, useRemoveLicense } from '../../../hooks/useLicense';
import { STATUS_LABELS, licenseSourceNote } from '../../../components/license/licenseUtils';
import { LicenseKeyForm } from '../../../components/license/LicenseKeyForm';
import { Button } from '../../../components/ui/Button';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ConfirmDialog } from '../../../components/overlays/ConfirmDialog';
import { AlertTriangleIcon, CrownIcon, ResetIcon, ServerIcon, TrashIcon } from '../../../components/icons';
import { fmtDate } from '../../../lib/format';
import { cn } from '../../../lib/cn';
import { SectionHeader } from '../components/SectionHeader';
import { StatusCell } from '../components/StatusCell';

/**
 * Enterprise support key: shows whether a support contract is on file (status, validity, who it
 * is registered to), and lets an admin validate + activate a key without a restart, remove the
 * stored key, or force a re-check against the license server. The key has no functional effect —
 * every feature is available regardless.
 */
export function LicenseSection() {
  const { t, i18n } = useLingui();
  const { data: license, isLoading } = useLicense();
  const refresh = useRefreshLicense();
  const remove = useRemoveLicense();
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const header = (
    <SectionHeader
      title={t`Enterprise support`}
      subtitle={t`Every feature is included in Proxytrace. A support key records your Enterprise support contract.`}
    />
  );

  if (isLoading || !license) {
    return (
      <div className="w-full min-w-0 flex flex-col" data-testid="settings-license">
        {header}
        <Skeleton height={160} className="max-w-[760px]" />
      </div>
    );
  }

  const hasContract = license.tier === 'enterprise';
  const sourceNote = licenseSourceNote(license.source);
  const statusTone =
    license.status === 'active' ? cn('text-success')
    : license.status === 'free' ? cn('text-secondary')
    : license.status === 'grace' ? cn('text-warn')
    : cn('text-danger');

  return (
    <div className="w-full min-w-0 flex flex-col" data-testid="settings-license">
      {header}

      <div className="max-w-[760px] flex flex-col gap-5">
        <div className="bg-card-2 border border-hairline rounded-lg p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-h2 font-semibold m-0 text-primary flex items-center gap-2">
              <CrownIcon size={14} className={hasContract ? 'text-accent' : 'text-muted'} />
              <Trans>Support contract</Trans>
            </h3>
            {hasContract && !license.offline && (
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
              value={hasContract ? t`Enterprise support` : t`None`}
              testId="license-tier"
            />
            <StatusCell
              label={t`Status`}
              value={i18n._(STATUS_LABELS[license.status])}
              valueClassName={statusTone}
              testId="license-status"
            />
            <StatusCell
              label={t`Valid until`}
              value={license.expiresAt ? fmtDate(license.expiresAt) : '—'}
              testId="license-expires"
            />
          </div>

          {license.customerEmail && (
            <div className="text-body-sm text-secondary">
              <Trans>Registered to <span className="text-primary">{license.customerEmail}</span></Trans>
            </div>
          )}

          {license.status === 'invalid' && (
            <div className="flex items-start gap-1.5 text-body-sm text-danger" data-testid="license-invalid-note">
              <AlertTriangleIcon size={12} className="mt-0.5 shrink-0" />
              <span>
                <Trans>
                  The configured support key could not be validated
                  {license.invalidReason ? ` — ${license.invalidReason}` : ''}. Nothing is affected,
                  but no support contract is recorded until a valid key is activated.
                </Trans>
              </span>
            </div>
          )}

          {license.offline && (
            <div className="flex items-start gap-1.5 text-body-sm text-secondary" data-testid="license-offline-note">
              <ServerIcon size={12} className="mt-0.5 shrink-0 text-teal" />
              <span>
                <Trans>
                  This is an offline key. It is never re-validated against the license server, so
                  it works with no outbound connection — only its expiry ends it.
                </Trans>
              </span>
            </div>
          )}

          {sourceNote && <p className="text-body-sm text-muted m-0">{i18n._(sourceNote)}</p>}
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-h2 font-semibold m-0 text-primary"><Trans>Activate a support key</Trans></h3>
          <p className="text-body-sm text-muted m-0">
            <Trans>
              Paste the key from your support contract. It is validated offline, stored in the
              database, and applied immediately — no restart needed.
            </Trans>
          </p>
          <LicenseKeyForm />
        </div>

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
              <Trans>Remove stored key</Trans>
            </Button>
            <span className="text-body-sm text-muted">
              <Trans>Falls back to the environment-supplied key, if any.</Trans>
            </span>
          </div>
        )}
      </div>

      {confirmingRemove && (
        <ConfirmDialog
          title={t`Remove stored support key?`}
          message={t`The installation falls back to the environment-supplied key, if any. Every feature keeps working; only the recorded support contract changes.`}
          confirmLabel={t`Remove key`}
          loading={remove.isPending}
          onCancel={() => setConfirmingRemove(false)}
          onConfirm={() => remove.mutate(undefined, { onSuccess: () => setConfirmingRemove(false) })}
        />
      )}
    </div>
  );
}
