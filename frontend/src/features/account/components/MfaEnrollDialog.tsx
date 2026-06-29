import { useEffect, useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { QRCodeSVG } from 'qrcode.react'
import { Modal } from '../../../components/overlays/Modal'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { FormField } from '../../../components/ui/FormField'
import { useMfaSetup, useMfaActivate } from '../hooks/useMfa'
import { BackupCodesPanel } from './BackupCodesPanel'

interface MfaEnrollDialogProps {
  onClose: () => void
}

/** Two-step enrollment: scan the QR + confirm a code, then view the one-time backup codes. */
export function MfaEnrollDialog({ onClose }: MfaEnrollDialogProps) {
  const { t } = useLingui()
  const setup = useMfaSetup()
  const activate = useMfaActivate()
  const [code, setCode] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)

  // Kick off setup once when the dialog opens. The mutation owns loading/error state.
  const { mutate: startSetup } = setup
  useEffect(() => { startSetup() }, [startSetup])

  const onConfirm = async () => {
    setErr(null)
    try {
      const res = await activate.mutateAsync(code)
      setBackupCodes(res.backupCodes)
    } catch {
      setErr(t`Invalid code. Check your authenticator app and try again.`)
    }
  }

  if (backupCodes) {
    return (
      <Modal
        title={t`Save your backup codes`}
        onClose={onClose}
        footer={<Button onClick={onClose} data-testid="mfa-enroll-done"><Trans>Done</Trans></Button>}
      >
        <BackupCodesPanel codes={backupCodes} />
      </Modal>
    )
  }

  return (
    <Modal
      title={t`Set up two-factor authentication`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}><Trans>Cancel</Trans></Button>
          <Button
            onClick={onConfirm}
            loading={activate.isPending}
            disabled={!setup.data || code.length === 0}
            data-testid="mfa-activate-submit"
          >
            <Trans>Verify &amp; enable</Trans>
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-body-sm text-muted">
          <Trans>
            Scan this QR code with an authenticator app (Google Authenticator, 1Password, Authy),
            then enter the 6-digit code it shows.
          </Trans>
        </p>

        {setup.isPending && <p className="text-body-sm text-muted"><Trans>Preparing…</Trans></p>}
        {setup.isError && <p className="text-body text-danger"><Trans>Could not start setup. Please try again.</Trans></p>}

        {setup.data && (
          <>
            <div className="flex justify-center rounded-md bg-white p-3 w-fit mx-auto" data-testid="mfa-qr">
              <QRCodeSVG value={setup.data.otpAuthUri} size={176} />
            </div>
            <div className="text-center">
              <p className="text-caption text-muted"><Trans>Or enter this key manually</Trans></p>
              <code className="font-mono text-body-sm text-secondary break-all" data-testid="mfa-secret">
                {setup.data.secret}
              </code>
            </div>
            <FormField label={t`Authentication code`}>
              <Input
                data-testid="mfa-activate-code"
                placeholder={t`6-digit code`}
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </FormField>
            {err && <p className="text-body text-danger" data-testid="mfa-activate-error">{err}</p>}
          </>
        )}
      </div>
    </Modal>
  )
}
