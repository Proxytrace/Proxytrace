import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { localAuthApi } from '../../auth/local/localAuthApi';
import { useInvitePreview } from './hooks/useInvitePreview';
import { PasswordRequirements } from '../../components/auth/PasswordRequirements';
import { Button } from '../../components/ui/Button';
import { FormField } from '../../components/ui/FormField';
import { Input } from '../../components/ui/Input';
import { LockIcon } from '../../components/icons';
import useLocalAuth from '../../hooks/useLocalAuth';
import { passwordIsValid } from '../../auth/password';

export default function Signup() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const { setToken } = useLocalAuth();

  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { data: preview, isError: expired } = useInvitePreview(token);

  if (expired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-6 text-center text-primary">
        <div>
          <h1 className="text-lg font-semibold">Invite expired or already used</h1>
          <p className="mt-2 text-sm text-muted">Ask an admin for a new invite link.</p>
        </div>
      </div>
    );
  }

  if (!preview) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface text-primary">
      <form
        className="w-96 space-y-3 rounded-xl border border-border bg-surface-2 p-6 shadow-[var(--shadow-card)]"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!passwordIsValid(password)) return;
          setSubmitting(true);
          setErr(null);
          try {
            const r = await localAuthApi.signup(token, password);
            setToken(r.token);
            navigate('/');
          } catch {
            setErr('Could not complete signup. The invite may have expired.');
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <h1 className="text-lg font-semibold">Create your account</h1>
        <p className="text-xs text-muted">
          Role: <span className="text-primary">{preview.role}</span>
        </p>
        {/* Email is fixed by the invite — the backend ignores any client value and uses the
            invited address, so the field is locked here to match. */}
        <FormField label="Email">
          <Input
            value={preview.email}
            data-testid="signup-email"
            disabled
            readOnly
            rightAddon={<LockIcon size={14} />}
          />
        </FormField>
        <Input
          data-testid="signup-password"
          type="password"
          placeholder="Password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <PasswordRequirements password={password} />
        {err && <p data-testid="signup-error" className="text-sm text-danger">{err}</p>}
        <Button data-testid="signup-submit" type="submit" fullWidth loading={submitting} disabled={!passwordIsValid(password)}>
          Create account
        </Button>
      </form>
    </div>
  );
}
