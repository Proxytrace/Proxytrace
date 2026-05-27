import { BrowserRouter } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AuthProvider } from 'react-oidc-context';
import { PageLoader } from '../components/layout/PageLoader';
import { configApi } from '../api/config';
import { QUERY_KEYS } from '../api/query-keys';
import { oidcConfig } from './oidcConfig';
import { useAuthMode } from './authMode';
import { LocalAuthProvider } from './local/LocalAuthProvider';
import { AppRoutes } from './AppRoutes';
import { KioskShell } from './KioskShell';
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
