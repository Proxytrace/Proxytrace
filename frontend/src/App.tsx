import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { AuthProvider, useAuth } from 'react-oidc-context';
import { lazy, Suspense, useEffect } from 'react';
import { Shell } from './components/layout/Shell';
import { ToastProvider } from './components/ui/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProjectProvider } from './contexts/ProjectContext';
import { setupApi } from './api/setup';
import { oidcConfig } from './auth/oidcConfig';
import { setAccessToken, setUnauthorizedHandler } from './auth/token';
import { fetchAuthMode, useAuthMode } from './auth/authMode';
import { LocalAuthProvider, useLocalAuth } from './auth/local/LocalAuthProvider';
import { CurrentUserContext, type CurrentUser } from './auth/useCurrentUser';

const Setup = lazy(() => import('./features/setup/Setup'));
const Dashboard = lazy(() => import('./features/dashboard/Dashboard'));
const Traces = lazy(() => import('./features/traces/Traces'));
const Agents = lazy(() => import('./features/agents/Agents'));
const Suites = lazy(() => import('./features/suites/Suites'));
const Evaluators = lazy(() => import('./features/evaluators/Evaluators'));
const Runs = lazy(() => import('./features/runs/Runs'));
const Providers = lazy(() => import('./features/providers/Providers'));
const Proposals = lazy(() => import('./features/proposals/Proposals'));
const Settings = lazy(() => import('./features/settings/Settings'));
const Playground = lazy(() => import('./features/playground/Playground'));
const Login = lazy(() => import('./features/auth/Login'));
const Signup = lazy(() => import('./features/auth/Signup'));
const Invites = lazy(() => import('./features/admin/Invites'));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000, throwOnError: true } },
});

// Prefetch auth-mode so children can render synchronously.
queryClient.prefetchQuery({ queryKey: ['auth-mode'], queryFn: fetchAuthMode, staleTime: Infinity });

function PageLoader() {
  return (
    <div className="flex items-center justify-center flex-1 text-muted text-[13px]">
      Loading…
    </div>
  );
}

function OidcAuthGate({ children }: { children: React.ReactNode }) {
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

function LocalAuthGate({ children }: { children: React.ReactNode }) {
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

function AppRoutes() {
  const { data: setupStatus } = useQuery({
    queryKey: ['setup-status'],
    queryFn: setupApi.getStatus,
    staleTime: Infinity,
  });
  const { data: authMode } = useAuthMode();

  if (setupStatus === undefined || authMode === undefined) return <PageLoader />;

  const wrap = (el: React.ReactNode) => (
    <ErrorBoundary><Suspense fallback={<PageLoader />}>{el}</Suspense></ErrorBoundary>
  );

  const setupNeeded = !setupStatus.isConfigured || (authMode.mode === 'local' && authMode.setupRequired);

  return (
    <Routes>
      {authMode.mode === 'local' && <Route path="/signup" element={wrap(<Signup />)} />}
      <Route
        path="/setup"
        element={setupNeeded ? wrap(<Setup />) : <Navigate to="/dashboard" replace />}
      />
      <Route
        path="/"
        element={setupNeeded ? <Navigate to="/setup" replace /> : <ProjectProvider><Shell /></ProjectProvider>}
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={wrap(<Dashboard />)} />
        <Route path="traces" element={wrap(<Traces />)} />
        <Route path="agents" element={wrap(<Agents />)} />
        <Route path="suites" element={wrap(<Suites />)} />
        <Route path="evaluators" element={wrap(<Evaluators />)} />
        <Route path="evaluators/:id" element={wrap(<Evaluators />)} />
        <Route path="runs" element={wrap(<Runs />)} />
        <Route path="playground" element={wrap(<Playground />)} />
        <Route path="providers" element={wrap(<Providers />)} />
        <Route path="settings" element={wrap(<Settings />)} />
        <Route path="proposals" element={wrap(<Proposals />)} />
        {authMode.mode === 'local' && <Route path="admin/invites" element={wrap(<Invites />)} />}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

function ModeShell() {
  const { data, isLoading, error } = useAuthMode();
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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ModeShell />
      </ToastProvider>
    </QueryClientProvider>
  );
}
