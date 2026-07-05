import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useSetLicense, useValidateLicense } from '../../hooks/useLicense';
import type { ValidateLicenseResultDto } from '../../api/license';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';
import { showToast } from '../ui/Toast';
import { CheckIcon, AlertTriangleIcon } from '../icons';
import { fmtDate } from '../../lib/format';

/**
 * Paste-a-license-key form shared by the setup wizard's Welcome step and the
 * settings License page. "Validate" is a dry run (nothing stored); "Activate"
 * stores and applies the key without a restart.
 */
export function LicenseKeyForm({ onApplied }: { onApplied?: () => void }) {
  const { t } = useLingui();
  const [key, setKey] = useState('');
  const [preview, setPreview] = useState<ValidateLicenseResultDto | null>(null);
  const validate = useValidateLicense();
  const apply = useSetLicense();

  const trimmed = key.trim();

  const onValidate = () =>
    validate.mutate(trimmed, { onSuccess: setPreview });

  const onActivate = () =>
    apply.mutate(trimmed, {
      onSuccess: () => {
        showToast(t`License activated.`, 'success');
        setKey('');
        setPreview(null);
        onApplied?.();
      },
    });

  return (
    <div className="flex flex-col gap-2" data-testid="license-key-form">
      <Textarea
        rows={3}
        value={key}
        invalid={preview?.valid === false}
        onChange={e => {
          setKey(e.target.value);
          setPreview(null);
        }}
        placeholder={t`Paste your license key (JWT) here`}
        className="font-mono text-body-sm"
        data-testid="license-key-input"
        aria-label={t`License key`}
      />

      {preview && (preview.valid ? (
        <div className="flex items-center gap-1.5 text-body-sm text-success" data-testid="license-validate-ok">
          <CheckIcon size={12} strokeWidth={2.5} />
          <span>
            {t`Valid ${preview.tier === 'enterprise' ? 'Enterprise' : 'Free'} license`}
            {preview.offline ? t` (offline)` : ''}
            {preview.customerEmail ? t` for ${preview.customerEmail}` : ''}
            {preview.expiresAt ? t`, valid until ${fmtDate(preview.expiresAt)}` : ''}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-body-sm text-danger" data-testid="license-validate-error">
          <AlertTriangleIcon size={12} />
          <span>{preview.reason ?? t`This license key is not valid.`}</span>
        </div>
      ))}

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={!trimmed}
          loading={validate.isPending}
          onClick={onValidate}
          data-testid="license-validate-btn"
        >
          <Trans>Validate</Trans>
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={!trimmed || preview?.valid === false}
          loading={apply.isPending}
          onClick={onActivate}
          data-testid="license-activate-btn"
        >
          <Trans>Activate license</Trans>
        </Button>
      </div>
    </div>
  );
}
