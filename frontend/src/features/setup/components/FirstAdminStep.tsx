import { useState } from 'react';
import { FormField } from '../../../components/ui/FormField';
import { PasswordRequirements } from '../../../components/auth/PasswordRequirements';
import { formInputCls } from '../../../components/ui/classes';
import { localAuthApi } from '../../../auth/local/localAuthApi';
import useLocalAuth from '../../../hooks/useLocalAuth';
import { passwordIsValid } from '../../../auth/password';

interface FirstAdminStepProps {
  onDone: () => void;
}

export function FirstAdminStep({ onDone }: FirstAdminStepProps) {
  const localAuth = useLocalAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface p-6 sm:p-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_-10%,color-mix(in srgb, var(--accent-primary) 10%, transparent),transparent_55%),radial-gradient(circle_at_80%_110%,color-mix(in srgb, var(--teal) 8%, transparent),transparent_55%)]"
      />
      <form
        className="relative w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-float)]"
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
            setErr(status === 409 ? 'Admin already exists.' : 'Could not create admin.');
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-accent">
            Step 0
          </div>
          <h1 className="text-[20px] font-bold text-primary tracking-[-0.01em]">Create the first admin</h1>
          <p className="mt-1.5 text-[13px] text-secondary">
            Local install needs an administrator account before you can configure providers.
          </p>
        </div>
        <FormField label="Email">
          <input
            className={formInputCls}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </FormField>
        <FormField label="Password">
          <input
            className={formInputCls}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </FormField>
        <PasswordRequirements password={password} />
        {err && <p className="text-sm text-danger">{err}</p>}
        <button
          type="submit"
          disabled={submitting || !passwordIsValid(password) || email.trim() === ''}
          className="w-full rounded-[9px] bg-accent px-4 py-[10px] text-[13px] font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Creating…' : 'Create admin'}
        </button>
      </form>
    </div>
  );
}
