import { lazy, Suspense, useEffect } from 'react';
import { useAuth } from 'react-oidc-context';
import { PageLoader } from '../components/layout/PageLoader';
import { setAccessToken, setUnauthorizedHandler } from './token';
import { CurrentUserContext, type CurrentUser } from './useCurrentUser';

const Login = lazy(() => import('../features/auth/Login'));

export function OidcAuthGate({ children }: { children: React.ReactNode }) {
  const auth = useAuth();

  useEffect(() => {
    setAccessToken(auth.user?.access_token ?? null);
  }, [auth.user?.access_token]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void auth.signinRedirect();
    });
    return () => setUnauthorizedHandler(null);
  }, [auth]);

  if (auth.isLoading || auth.activeNavigator) return <PageLoader />;
  if (auth.error) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-danger">
        Auth error: {auth.error.message}
      </div>
    );
  }
  if (!auth.isAuthenticated) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Login />
      </Suspense>
    );
  }
  const profile = auth.user?.profile as { email?: string } | undefined;
  const currentUser: CurrentUser | null = profile?.email
    ? { email: profile.email, signOut: () => void auth.signoutRedirect() }
    : null;
  return <CurrentUserContext.Provider value={currentUser}>{children}</CurrentUserContext.Provider>;
}
