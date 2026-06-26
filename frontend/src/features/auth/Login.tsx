import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import { useAuthMode } from '../../auth/authMode';
import { localAuthApi } from '../../auth/local/localAuthApi';
import { PasswordRequirements } from '../../components/auth/PasswordRequirements';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import useLocalAuth from '../../hooks/useLocalAuth';
import { passwordIsValid } from '../../auth/password';
import { BrandMark } from '../../components/ui/BrandMark';
import { MfaChallengeForm } from './components/MfaChallengeForm';

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
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface text-primary">
      <div className="flex items-center gap-3">
        <BrandMark size={36} />
        <span className="text-2xl font-bold tracking-[-0.02em] leading-none">
          {/* eslint-disable-next-line lingui/no-unlocalized-strings -- brand wordmark */}
          <span className="text-primary">proxy</span><span className="text-accent">trace</span>
        </span>
      </div>
      <p className="text-muted text-sm"><Trans>Sign in to continue.</Trans></p>
      {auth.error && (
        <div className="rounded border border-danger px-3 py-2 text-sm text-danger">
          {auth.error.message}
        </div>
      )}
      <Button loading={auth.isLoading} onClick={() => void auth.signinRedirect()}>
        <Trans>Sign in</Trans>
      </Button>
    </div>
  );
}

function LocalLogin() {
  const { t } = useLingui();
  const { setToken } = useLocalAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Set when the password step passes but the account requires a TOTP second factor.
  const [challengeToken, setChallengeToken] = useState<string | null>(null);

  const completeLogin = (token: string) => {
    setToken(token);
    navigate('/');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface text-primary">
      <div className="w-80 rounded-xl border border-border bg-surface-2 p-6 shadow-[var(--shadow-card)]">
        {challengeToken ? (
          <MfaChallengeForm challengeToken={challengeToken} onVerified={completeLogin} />
        ) : (
          <form
            data-testid="login-form"
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setErr(null);
              setSubmitting(true);
              try {
                const outcome = await localAuthApi.login(email, password);
                if (outcome.mfaRequired) {
                  setChallengeToken(outcome.challengeToken);
                } else {
                  completeLogin(outcome.token);
                }
              } catch {
                setErr(t`Invalid email or password.`);
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <h1 className="text-lg font-semibold"><Trans>Sign in</Trans></h1>
            <Input
              data-testid="login-email"
              placeholder={t`Email`}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              data-testid="login-password"
              placeholder={t`Password`}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {err && <p data-testid="login-error" className="text-sm text-danger">{err}</p>}
            <Button data-testid="login-submit" type="submit" fullWidth loading={submitting}>
              <Trans>Sign in</Trans>
            </Button>
            <Link
              to="/forgot-password"
              data-testid="login-forgot-password"
              className="block text-center text-body-sm text-accent hover:underline"
            >
              <Trans>Forgot password?</Trans>
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}

function LegacyClaim() {
  const { t } = useLingui();
  const { setToken } = useLocalAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const valid = passwordIsValid(password);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface text-primary">
      <form
        className="w-96 space-y-3 rounded-xl border border-border bg-surface-2 p-6 shadow-[var(--shadow-card)]"
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
            setErr(t`Could not claim account. Check the email matches your existing user.`);
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <h1 className="text-lg font-semibold"><Trans>Set a password for your account</Trans></h1>
        <p className="text-xs text-muted">
          <Trans>Local authentication was enabled on this install. Confirm your email and choose a password to finish migrating your existing user.</Trans>
        </p>
        <Input
          placeholder={t`Email`}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          placeholder={t`New password`}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <PasswordRequirements password={password} />
        {err && <p className="text-sm text-danger">{err}</p>}
        <Button type="submit" fullWidth loading={submitting} disabled={!valid}>
          <Trans>Set password &amp; sign in</Trans>
        </Button>
      </form>
    </div>
  );
}
