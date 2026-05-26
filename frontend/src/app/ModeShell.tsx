import { BrowserRouter } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AuthProvider } from 'react-oidc-context';
import { configApi } from '../api/config';
import { QUERY_KEYS } from '../api/query-keys';
import { oidcConfig } from '../auth/oidcConfig';
import { useAuthMode } from '../auth/authMode';
import { LocalAuthProvider } from '../auth/local/LocalAuthProvider';
import { PageLoader } from './PageLoader';
import { KioskShell } from './KioskShell';
import { AppRoutes } from './AppRoutes';
import { LocalAuthGate } from './LocalAuthGate';
import { OidcAuthGate } from './OidcAuthGate';

export function ModeShell() {
  const { data: appConfig } = useQuery({
    queryKey: QUERY_KEYS.appConfig,
    queryFn: configApi.get,
    staleTime: Infinity,
  });
  const { data, isLoading, error } = useAuthMode();
  if (appConfig?.kiosk) return <KioskShell />;
  if (isLoading) return <PageLoader />;
  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-danger">
        Could not detect auth mode.
      </div>
    );
  }
  if (data.mode === 'local') {
    return (
      <BrowserRouter>
        <LocalAuthProvider>
          <LocalAuthGate>
            <AppRoutes />
          </LocalAuthGate>
        </LocalAuthProvider>
      </BrowserRouter>
    );
  }
  return (
    <AuthProvider {...oidcConfig}>
      <BrowserRouter>
        <OidcAuthGate>
          <AppRoutes />
        </OidcAuthGate>
      </BrowserRouter>
    </AuthProvider>
  );
}
