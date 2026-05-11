import { useAuth } from 'react-oidc-context';

export default function Login() {
  const auth = useAuth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg text-fg">
      <h1 className="text-2xl font-semibold">Trsr</h1>
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
