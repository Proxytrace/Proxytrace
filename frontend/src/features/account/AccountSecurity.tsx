import { useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { useAuthMode } from '../../auth/authMode'
import { useMe } from '../../hooks/useMe'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Pill } from '../../components/ui/Pill'
import { Skeleton } from '../../components/ui/Skeleton'
import { MfaEnrollDialog } from './components/MfaEnrollDialog'
import { MfaDisableDialog } from './components/MfaDisableDialog'

/** Per-user account security: enable/disable TOTP two-factor authentication. Local-auth only. */
export default function AccountSecurity() {
  const { t } = useLingui()
  const { data: authMode } = useAuthMode()
  const { data: me, isLoading } = useMe()
  const [dialog, setDialog] = useState<'enroll' | 'disable' | null>(null)

  const isLocal = authMode?.mode === 'local'
  const enabled = me?.mfaEnabled ?? false

  /* eslint-disable lingui/no-unlocalized-strings -- dialog state tokens, not UI copy */
  const openEnroll = () => setDialog('enroll')
  const openDisable = () => setDialog('disable')
  /* eslint-enable lingui/no-unlocalized-strings */

  return (
    <div className="space-y-8 p-6 max-w-3xl">
      <header>
        <h1 className="text-h1 font-semibold"><Trans>Account security</Trans></h1>
        <p className="text-body-sm text-muted mt-1"><Trans>Manage how you sign in to your account.</Trans></p>
      </header>

      <Card padding="lg">
        <Card.Header>
          <div className="flex items-center gap-2">
            <h2 className="text-h2 font-semibold"><Trans>Two-factor authentication</Trans></h2>
            {!isLoading && (
              <Pill
                label={enabled ? t`Enabled` : t`Disabled`}
                color={enabled ? 'var(--color-success)' : 'var(--text-muted)'}
                size="sm"
              />
            )}
          </div>
        </Card.Header>
        <Card.Body>
          {!isLocal ? (
            <p className="text-body-sm text-muted">
              <Trans>Two-factor authentication is managed by your identity provider.</Trans>
            </p>
          ) : isLoading ? (
            <Skeleton className="h-9 w-40" />
          ) : (
            <div className="space-y-4">
              <p className="text-body-sm text-secondary">
                <Trans>
                  Protect your account with a time-based one-time code from an authenticator app, in
                  addition to your password.
                </Trans>
              </p>
              {enabled ? (
                <Button
                  variant="dangerOutline"
                  data-testid="mfa-disable-btn"
                  onClick={openDisable}
                >
                  <Trans>Disable two-factor authentication</Trans>
                </Button>
              ) : (
                <Button data-testid="mfa-setup-btn" onClick={openEnroll}>
                  <Trans>Set up two-factor authentication</Trans>
                </Button>
              )}
            </div>
          )}
        </Card.Body>
      </Card>

      {dialog === 'enroll' && <MfaEnrollDialog onClose={() => setDialog(null)} />}
      {dialog === 'disable' && <MfaDisableDialog onClose={() => setDialog(null)} />}
    </div>
  )
}
