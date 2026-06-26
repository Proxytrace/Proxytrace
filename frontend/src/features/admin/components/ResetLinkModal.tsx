import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { Modal } from '../../../components/overlays/Modal';
import { Button } from '../../../components/ui/Button';

interface ResetLinkModalProps {
  email: string;
  link: string;
  expiresAt: string;
  onClose: () => void;
}

/** Reveals a freshly minted, one-time password-reset link for an admin to relay out-of-band. */
export function ResetLinkModal({ email, link, expiresAt, onClose }: ResetLinkModalProps) {
  const { t } = useLingui();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Modal title={t`Password reset link — ${email}`} onClose={onClose}>
      <div data-testid="reset-link-modal" className="space-y-3">
        <p className="text-body-sm text-muted">
          <Trans>Share this one-time link with the user. It won't be shown again.</Trans>
        </p>
        <p className="text-body-sm text-muted">
          {t`Expires ${new Date(expiresAt).toLocaleString()}`}
        </p>
        <div className="flex items-center gap-2 rounded border border-border bg-surface p-3 text-sm">
          <code data-testid="reset-link-value" className="flex-1 truncate">{link}</code>
          <Button variant="secondary" size="sm" data-testid="reset-link-copy-btn" onClick={copy}>
            {copied ? <Trans>Copied!</Trans> : <Trans>Copy</Trans>}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
