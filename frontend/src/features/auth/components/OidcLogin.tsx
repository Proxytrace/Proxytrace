import { Trans } from '@lingui/react/macro';
import { useAuth } from 'react-oidc-context';
import { Button } from '../../../components/ui/Button';
import { BrandMark } from '../../../components/ui/BrandMark';

/** Sign-in screen for installs delegating authentication to an external OIDC provider. */
export function OidcLogin() {
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
      <p className="text-muted text-body"><Trans>Sign in to continue.</Trans></p>
      {auth.error && (
        <div className="rounded-sm border border-danger px-3 py-2 text-body text-danger">
          {auth.error.message}
        </div>
      )}
      <Button loading={auth.isLoading} onClick={() => void auth.signinRedirect()}>
        <Trans>Sign in</Trans>
      </Button>
    </div>
  );
}
