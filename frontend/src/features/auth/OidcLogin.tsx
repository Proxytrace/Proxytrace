import { useAuth } from 'react-oidc-context';
import { BrandMark } from '../../components/ui/BrandMark';
import { Button } from '../../components/ui/Button';

export function OidcLogin() {
  const auth = useAuth();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface text-primary">
      <div className="flex items-center gap-3">
        <BrandMark size={36} />
        <span className="text-2xl font-bold tracking-[-0.02em] leading-none">
          <span className="text-primary">proxy</span><span className="text-accent">trace</span>
        </span>
      </div>
      <p className="text-muted text-sm">Sign in to continue.</p>
      {auth.error && (
        <div className="rounded border border-danger px-3 py-2 text-sm text-danger">
          {auth.error.message}
        </div>
      )}
      <Button
        variant="primary"
        loading={auth.isLoading}
        disabled={auth.isLoading}
        onClick={() => void auth.signinRedirect()}
      >
        {auth.isLoading ? 'Redirecting…' : 'Sign in'}
      </Button>
    </div>
  );
}
