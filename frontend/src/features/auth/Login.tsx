import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import { useAuthMode } from '../../auth/authMode';
import { localAuthApi } from '../../auth/local/localAuthApi';
import { PasswordRequirements } from '../../components/auth/PasswordRequirements';
import useLocalAuth from '../../hooks/useLocalAuth';
import { passwordIsValid } from '../../auth/password';

export default function Login() {
  const { data } = useAuthMode();
  if (!data) return null;
  if (data.mode !== 'local') return <OidcLogin />;
  if (data.setupRequired) return <Navigate to="/setup" replace />;
  if (data.legacyClaimAvailable) return <LegacyClaim />;
  return <LocalLogin />;
}

function OidcLogin() {
  const auth = useAuth();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg text-fg">
      <h1 className="text-2xl font-semibold">Proxytrace</h1>
      <p className="text-muted text-sm">Sign in to continue.</p>
      {auth.error && (
        <div className="rounded border border-danger px-3 py-2 text-sm text-danger">
          {auth.error.message}
        </div>
      )}
      <button
        type="button"
        className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        onClick={() => void auth.signinRedirect()}
        disabled={auth.isLoading}
      >
        {auth.isLoading ? 'Redirecting…' : 'Sign in'}
      </button>
    </div>
  );
}

function LocalLogin() {
  const { setToken } = useLocalAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg text-fg">
      <form
        className="w-80 space-y-3 rounded-xl border border-border bg-surface p-6 shadow-[var(--shadow-card)]"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          setSubmitting(true);
          try {
            const r = await localAuthApi.login(email, password);
            setToken(r.token);
            navigate('/');
          } catch {
            setErr('Invalid email or password.');
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <h1 className="text-lg font-semibold">Sign in</h1>
        <input
          className="w-full rounded border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
          placeholder="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="w-full rounded border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
          placeholder="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {err && <p className="text-sm text-danger">{err}</p>}
        <button
          className="w-full rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          type="submit"
          disabled={submitting}
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

function LegacyClaim() {
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
        <input
          className="w-full rounded border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
          placeholder="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="w-full rounded border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
          placeholder="New password"
          type="password"
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
          disabled={submitting || !valid}
        >
          {submitting ? 'Setting password…' : 'Set password & sign in'}
        </button>
      </form>
    </div>
  );
}
