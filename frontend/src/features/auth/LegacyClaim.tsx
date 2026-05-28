import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { localAuthApi } from '../../auth/local/localAuthApi';
import { passwordIsValid } from '../../auth/password';
import { PasswordRequirements } from '../../components/auth/PasswordRequirements';
import useLocalAuth from '../../hooks/useLocalAuth';
import { Button } from '../../components/ui/Button';
import { FormField } from '../../components/ui/FormField';
import { Input } from '../../components/ui/Input';

export default function LegacyClaim() {
  const { setToken } = useLocalAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const valid = passwordIsValid(password);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg text-fg">
      <form
        className="w-96 space-y-3 rounded-xl border border-border bg-surface p-6 shadow-[var(--shadow-card)]"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!valid) return;
          setErr(null);
          setSubmitting(true);
          try {
            const r = await localAuthApi.claimLegacy(email, password);
            setToken(r.token);
            navigate('/');
          } catch {
            setErr('Could not claim account. Check the email matches your existing user.');
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <h1 className="text-lg font-semibold">Set a password for your account</h1>
        <p className="text-xs text-muted">
          Local authentication was enabled on this install. Confirm your email and choose a password to finish migrating your existing user.
        </p>
        <FormField label="Email">
          <Input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </FormField>
        <FormField label="New password">
          <Input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </FormField>
        <PasswordRequirements password={password} />
        {err && <p className="text-sm text-danger">{err}</p>}
        <Button
          variant="primary"
          type="submit"
          loading={submitting}
          disabled={!valid}
          fullWidth
        >
          {submitting ? 'Setting password…' : 'Set password & sign in'}
        </Button>
      </form>
    </div>
  );
}
