import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { FormField } from '../../../components/ui/FormField';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { PasswordRequirements } from '../../../components/auth/PasswordRequirements';
import { localAuthApi } from '../../../auth/local/localAuthApi';
import useLocalAuth from '../../../hooks/useLocalAuth';
import { passwordIsValid } from '../../../auth/password';

interface FirstAdminStepProps {
  onDone: () => void;
}

export function FirstAdminStep({ onDone }: FirstAdminStepProps) {
  const { t } = useLingui();
  const localAuth = useLocalAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface p-6 sm:p-10">
      <form
        className="relative w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-8"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!passwordIsValid(password)) return;
          setErr(null);
          setSubmitting(true);
          try {
            const r = await localAuthApi.setup(email, password);
            localAuth.setToken(r.token);
            onDone();
          } catch (e2) {
            const status = (e2 as { status?: number }).status;
            setErr(status === 409 ? t`Admin already exists.` : t`Could not create admin.`);
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <div>
          <div className="mb-2 text-body-sm font-semibold uppercase tracking-[0.08em] text-accent">
            <Trans>Step 0</Trans>
          </div>
          {/* display-tier: intentional, outside type scale */}
          <h1 className="text-[20px] font-bold text-primary tracking-[-0.01em]"><Trans>Create the first admin</Trans></h1>
          <p className="mt-1.5 text-title text-secondary">
            <Trans>Local install needs an administrator account before you can configure providers.</Trans>
          </p>
        </div>
        <FormField label={t`Email`}>
          <Input
            type="email"
            autoComplete="email"
            placeholder={t`you@example.com`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </FormField>
        <FormField label={t`Password`}>
          <Input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </FormField>
        <PasswordRequirements password={password} />
        {err && <p className="text-body text-danger">{err}</p>}
        <Button
          type="submit"
          fullWidth
          loading={submitting}
          disabled={!passwordIsValid(password) || email.trim() === ''}
        >
          <Trans>Create admin</Trans>
        </Button>
      </form>
    </div>
  );
}
