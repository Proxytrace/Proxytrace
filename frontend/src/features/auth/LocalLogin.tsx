import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { localAuthApi } from '../../auth/local/localAuthApi';
import useLocalAuth from '../../hooks/useLocalAuth';
import { Button } from '../../components/ui/Button';
import { FormField } from '../../components/ui/FormField';
import { Input } from '../../components/ui/Input';

export default function LocalLogin() {
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
        <FormField label="Email">
          <Input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </FormField>
        <FormField label="Password">
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </FormField>
        {err && <p className="text-sm text-danger">{err}</p>}
        <Button variant="primary" type="submit" loading={submitting} fullWidth>
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
