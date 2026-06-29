import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { localAuthApi } from '../../../auth/local/localAuthApi';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';

interface MfaChallengeFormProps {
  challengeToken: string;
  /** Called with the issued session token once the second factor is verified. */
  onVerified: (token: string) => void;
}

/**
 * Second step of the two-step login: the user enters a TOTP code (or a backup code) to complete a
 * challenge issued after the password step. Shared by the sign-in and password-reset flows.
 */
export function MfaChallengeForm({ challengeToken, onVerified }: MfaChallengeFormProps) {
  const { t } = useLingui();
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      data-testid="mfa-challenge-form"
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setErr(null);
        setSubmitting(true);
        try {
          const outcome = await localAuthApi.mfaVerify(challengeToken, code);
          if (outcome.mfaRequired) {
            // The verify endpoint only ever issues a session on success; defensive guard.
            setErr(t`Could not verify the code. Please try again.`);
            return;
          }
          onVerified(outcome.token);
        } catch {
          setErr(t`Invalid code. Try again, or use one of your backup codes.`);
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <h1 className="text-h1 font-semibold"><Trans>Two-factor authentication</Trans></h1>
      <p className="text-body-sm text-muted">
        <Trans>Enter the 6-digit code from your authenticator app, or one of your backup codes.</Trans>
      </p>
      <Input
        data-testid="mfa-code-input"
        placeholder={t`Authentication code`}
        autoComplete="one-time-code"
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value)}
        required
      />
      {err && <p data-testid="mfa-error" className="text-body text-danger">{err}</p>}
      <Button data-testid="mfa-verify-submit" type="submit" fullWidth loading={submitting}>
        <Trans>Verify</Trans>
      </Button>
    </form>
  );
}
