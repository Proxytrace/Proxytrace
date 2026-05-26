import { useLocation } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { CurrentUserContext, type CurrentUser } from '../auth/useCurrentUser';
import useLocalAuth from '../hooks/useLocalAuth';
import { PageLoader } from './PageLoader';

const Login = lazy(() => import('../features/auth/Login'));

export function LocalAuthGate({ children }: { children: React.ReactNode }) {
  const local = useLocalAuth();
  const { pathname } = useLocation();

  const currentUser: CurrentUser | null = local.user
    ? { email: local.user.email, role: local.user.role, signOut: () => local.signoutRedirect() }
    : null;

  if (pathname === '/signup' || pathname === '/setup') {
    return <CurrentUserContext.Provider value={currentUser}>{children}</CurrentUserContext.Provider>;
  }
  if (!local.isAuthenticated) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Login />
      </Suspense>
    );
  }
  return <CurrentUserContext.Provider value={currentUser}>{children}</CurrentUserContext.Provider>;
}
