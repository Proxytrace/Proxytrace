import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { localAuthApi, type InvitePreview } from '../../auth/local/localAuthApi';
import { useLocalAuth } from '../../auth/local/LocalAuthProvider';
import { PasswordRequirements, passwordIsValid } from '../../components/auth/PasswordRequirements';

export default function Signup() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const { setToken } = useLocalAuth();

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [expired, setExpired] = useState(false);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setExpired(true);
      return;
    }
    localAuthApi
      .fetchInvite(token)
      .then(setPreview)
      .catch(() => setExpired(true));
  }, [token]);

  if (expired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg p-6 text-center text-fg">
        <div>
          <h1 className="text-lg font-semibold">Invite expired or already used</h1>
          <p className="mt-2 text-sm text-muted">Ask an admin for a new invite link.</p>
        </div>
      </div>
    );
  }

  if (!preview) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg text-fg">
      <form
        className="w-96 space-y-3 rounded-xl border border-border bg-surface p-6 shadow-[var(--shadow-card)]"
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
          Role: <span className="text-fg">{preview.role}</span>
        </p>
        <input
          className="w-full rounded border border-border bg-bg px-3 py-2 text-sm text-muted"
          value={preview.email}
          readOnly
        />
        <input
          className="w-full rounded border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
          type="password"
          placeholder="Password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <PasswordRequirements password={password} />
        {err && <p className="text-sm text-danger">{err}</p>}
        <button
          className="w-full rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          type="submit"
          disabled={submitting || !passwordIsValid(password)}
        >
          {submitting ? 'Creating…' : 'Create account'}
        </button>
      </form>
    </div>
  );
}
