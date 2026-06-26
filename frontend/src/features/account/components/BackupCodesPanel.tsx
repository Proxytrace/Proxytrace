import { Trans } from '@lingui/react/macro'
import { Button } from '../../../components/ui/Button'

interface BackupCodesPanelProps {
  codes: string[]
}

/** Shows the one-time backup codes once at activation, with copy + download affordances. */
export function BackupCodesPanel({ codes }: BackupCodesPanelProps) {
  const copy = () => void navigator.clipboard?.writeText(codes.join('\n'))
  const download = () => {
    const blob = new Blob([codes.join('\n') + '\n'], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    // eslint-disable-next-line lingui/no-unlocalized-strings -- DOM tag name
    const a = document.createElement('a')
    a.href = url
    // eslint-disable-next-line lingui/no-unlocalized-strings -- file name, not UI copy
    a.download = 'proxytrace-backup-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-3">
      <p className="text-body-sm text-muted">
        <Trans>
          Save these backup codes somewhere safe. Each can be used once to sign in if you lose your
          authenticator. They will not be shown again.
        </Trans>
      </p>
      <ul
        data-testid="mfa-backup-codes"
        className="grid grid-cols-2 gap-2 rounded-md border border-border bg-card p-3 font-mono text-body"
      >
        {codes.map((code) => (
          <li key={code} className="text-primary">{code}</li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={copy} data-testid="mfa-copy-codes">
          <Trans>Copy</Trans>
        </Button>
        <Button variant="secondary" size="sm" onClick={download} data-testid="mfa-download-codes">
          <Trans>Download</Trans>
        </Button>
      </div>
    </div>
  )
}
