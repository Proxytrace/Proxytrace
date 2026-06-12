import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { AuthProvider, useAuth } from 'react-oidc-context';
import { lazy, Suspense, useEffect } from 'react';
import { Shell } from './components/layout/Shell';
import { ToastProvider } from './components/ui/Toast';
import { TooltipProvider } from './components/ui/Tooltip';
import { UpgradeModalProvider, showUpgradeModal } from './components/license/UpgradeModal';
import { UpgradeRequiredError } from './api/client';
import { ErrorBoundary } from './components/ErrorBoundary';
import ProjectProvider  from './contexts/ProjectProvider';
import { setupApi } from './api/setup';
import { configApi } from './api/config';
import { QUERY_KEYS } from './api/query-keys';
import { oidcConfig } from './auth/oidcConfig';
import { setAccessToken, setUnauthorizedHandler } from './auth/token';
import { fetchAuthMode, useAuthMode } from './auth/authMode';
import { LocalAuthProvider } from './auth/local/LocalAuthProvider';
import { CurrentUserContext, useCurrentUser, type CurrentUser } from './auth/useCurrentUser';
import { KioskContext } from './contexts/KioskContext';
import useLocalAuth from './hooks/useLocalAuth';
import { useAppConfig } from './hooks/useAppConfig';
import { RequiresFeature } from './components/license/RequiresFeature';
import { UpgradePlaceholder } from './components/license/UpgradePlaceholder';
// Settings sections are small and admin-only — eagerly imported (no separate chunk needed).
import { GeneralSection } from './features/settings/sections/GeneralSection';
import { MembersSection } from './features/settings/sections/MembersSection';
import { SearchIndexingSection } from './features/settings/sections/SearchIndexingSection';
import { ProjectsSection } from './features/settings/sections/ProjectsSection';
import { DangerZoneSection } from './features/settings/sections/DangerZoneSection';
import { LicenseSection } from './features/settings/sections/LicenseSection';

const Setup = lazy(() => import('./features/setup/Setup'));
const Dashboard = lazy(() => import('./features/dashboard/Dashboard'));
const Traces = lazy(() => import('./features/traces/Traces'));
const TraceyAI = lazy(() => import('./features/tracey/TraceyAI'));
const Agents = lazy(() => import('./features/agents/Agents'));
const Suites = lazy(() => import('./features/suites/Suites'));
const Evaluators = lazy(() => import('./features/evaluators/Evaluators'));
const Runs = lazy(() => import('./features/runs/Runs'));
const Providers = lazy(() => import('./features/providers/Providers'));
const Proposals = lazy(() => import('./features/proposals/Proposals'));
const SettingsLayout = lazy(() => import('./features/settings/SettingsLayout'));
const Playground = lazy(() => import('./features/playground/Playground'));
const EvaluatorPlayground = lazy(() => import('./features/evaluator-playground/EvaluatorPlayground'));
const Login = lazy(() => import('./features/auth/Login'));
const Signup = lazy(() => import('./features/auth/Signup'));
const Users = lazy(() => import('./features/admin/Users'));
const ErrorLog = lazy(() => import('./features/error-log/ErrorLog'));

// A 402 license rejection is surfaced as an upgrade dialog rather than the
// generic error toast / page crash. Routing it from both caches catches every
// mutation and query without per-call wiring.
function handleUpgradeError(error: unknown): boolean {
  if (error instanceof UpgradeRequiredError) {
    showUpgradeModal({ errorType: error.errorType, message: error.message });
    return true;
  }
  return false;
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000, throwOnError: true } },
  queryCache: new QueryCache({ onError: handleUpgradeError }),
  mutationCache: new MutationCache({ onError: handleUpgradeError }),
});

// Prefetch auth-mode so children can render synchronously.
queryClient.prefetchQuery({ queryKey: QUERY_KEYS.authMode, queryFn: fetchAuthMode, staleTime: Infinity });
queryClient.prefetchQuery({ queryKey: QUERY_KEYS.appConfig, queryFn: configApi.get, staleTime: Infinity });

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

  // The session lives in an httpOnly cookie; wait for the one-time /me restore so an
  // authenticated reload doesn't flash the login form.
  if (local.isRestoring) return <PageLoader />;

  const currentUser: CurrentUser | null = local.user
    ? { email: local.user.email, role: local.user.role, signOut: () => local.signoutRedirect() }
    : null;

  // Honest /login URL: signout lands here, and an authenticated visit bounces home.
  // Unauthenticated users on any *other* path still get the login form rendered in
  // place (below), so deep links survive the login round-trip.
  if (pathname === '/login') {
    return local.isAuthenticated ? (
      <Navigate to="/dashboard" replace />
    ) : (
      <Suspense fallback={<PageLoader />}>
        <Login />
      </Suspense>
    );
  }

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

// The evaluators detail moved from a path param (/evaluators/:id) to a query
// param (/evaluators?id=) for consistency with the other master-detail views.
// This keeps old bookmarks and shared links working.
function EvaluatorDeepLinkRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/evaluators?id=${encodeURIComponent(id)}` : '/evaluators'} replace />;
}

function AppRoutes() {
  const { data: setupStatus } = useQuery({
    queryKey: QUERY_KEYS.setupStatus,
    queryFn: setupApi.getStatus,
    staleTime: Infinity,
  });
  const { data: authMode } = useAuthMode();
  const currentUser = useCurrentUser();

  if (setupStatus === undefined || authMode === undefined) return <PageLoader />;

  // Client-side route gating only — the backend must still enforce admin authorization.
  const isAdmin = authMode.mode === 'local' && currentUser?.role === 'Admin';

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
        <Route path="tracey-ai" element={wrap(<RequiresFeature feature="Tracey"><TraceyAI /></RequiresFeature>)} />
        <Route path="agents" element={wrap(<Agents />)} />
        <Route path="suites" element={wrap(<Suites />)} />
        <Route path="evaluators" element={wrap(<Evaluators />)} />
        {/* Legacy/deep-link path form → canonical ?id= query selection. */}
        <Route path="evaluators/:id" element={<EvaluatorDeepLinkRedirect />} />
        <Route path="runs" element={wrap(<Runs />)} />
        <Route path="playground" element={wrap(<Playground />)} />
        <Route path="evaluator-playground" element={wrap(<EvaluatorPlayground />)} />
        <Route path="upgrade" element={wrap(<UpgradePlaceholder />)} />
        <Route
          path="proposals"
          element={wrap(<RequiresFeature feature="OptimizationProposals"><Proposals /></RequiresFeature>)}
        />
        {/* The entire settings hub is admin-only (the backend independently enforces this on every
            settings-mutating endpoint). Providers, Users, and the Error Log now live here as
            sections rather than as top-level routes. */}
        {isAdmin && (
          <Route path="settings" element={wrap(<SettingsLayout />)}>
            <Route index element={<Navigate to="/settings/general" replace />} />
            <Route path="general" element={<GeneralSection />} />
            <Route path="members" element={<MembersSection />} />
            <Route path="search" element={<SearchIndexingSection />} />
            <Route path="projects" element={<ProjectsSection />} />
            <Route path="providers" element={wrap(<Providers />)} />
            <Route path="users" element={wrap(<Users />)} />
            <Route path="license" element={<LicenseSection />} />
            <Route path="error-log" element={wrap(<ErrorLog />)} />
            <Route path="danger" element={<DangerZoneSection />} />
          </Route>
        )}
        {/* Legacy paths → settings sections, so bookmarks, Tracey, and docs links keep working. */}
        {isAdmin && <Route path="providers" element={<Navigate to="/settings/providers" replace />} />}
        {isAdmin && <Route path="error-log" element={<Navigate to="/settings/error-log" replace />} />}
        {isAdmin && <Route path="admin/users" element={<Navigate to="/settings/users" replace />} />}
        {isAdmin && <Route path="admin/invites" element={<Navigate to="/settings/users" replace />} />}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

function KioskShell({ interactive }: { interactive: boolean }) {
  useEffect(() => {
    // The `kiosk` body class drives the read-only [data-write] kill-switch (index.css). Only
    // apply it for a read-only kiosk; an interactive kiosk leaves write controls live.
    if (interactive) return;
    document.body.classList.add('kiosk');
    return () => document.body.classList.remove('kiosk');
  }, [interactive]);
  return (
    <KioskContext.Provider value={{ enabled: true, interactive }}>
      <BrowserRouter>
        <CurrentUserContext.Provider value={{ email: 'demo@proxytrace.dev', signOut: () => {} }}>
          <AppRoutes />
        </CurrentUserContext.Provider>
      </BrowserRouter>
    </KioskContext.Provider>
  );
}

function ModeShell() {
  const { data: appConfig } = useAppConfig();
  const { data, isLoading, error } = useAuthMode();
  if (appConfig?.kiosk) return <KioskShell interactive={!!appConfig.interactive} />;
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
        <TooltipProvider>
          <UpgradeModalProvider>
            <ModeShell />
          </UpgradeModalProvider>
        </TooltipProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
