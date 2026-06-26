import { useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Modal } from '../../../components/overlays/Modal'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { FormField } from '../../../components/ui/FormField'
import { useMfaDisable } from '../hooks/useMfa'

interface MfaDisableDialogProps {
  onClose: () => void
}

/** Confirms disabling MFA by re-authenticating with the account password. */
export function MfaDisableDialog({ onClose }: MfaDisableDialogProps) {
  const { t } = useLingui()
  const disable = useMfaDisable()
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const onConfirm = async () => {
    setErr(null)
    try {
      await disable.mutateAsync(password)
      onClose()
    } catch {
      setErr(t`Incorrect password.`)
    }
  }

  return (
    <Modal
      title={t`Disable two-factor authentication`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}><Trans>Cancel</Trans></Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            loading={disable.isPending}
            disabled={password.length === 0}
            data-testid="mfa-disable-submit"
          >
            <Trans>Disable</Trans>
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-body-sm text-muted">
          <Trans>Enter your password to turn off two-factor authentication. Your backup codes will be discarded.</Trans>
        </p>
        <FormField label={t`Password`}>
          <Input
            data-testid="mfa-disable-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FormField>
        {err && <p className="text-sm text-danger" data-testid="mfa-disable-error">{err}</p>}
      </div>
    </Modal>
  )
}
