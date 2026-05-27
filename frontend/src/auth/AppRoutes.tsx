import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Shell } from '../components/layout/Shell';
import { ErrorBoundary } from '../components/ErrorBoundary';
import ProjectProvider from '../contexts/ProjectProvider';
import { PageLoader } from '../components/layout/PageLoader';
import { setupApi } from '../api/setup';
import { QUERY_KEYS } from '../api/query-keys';
import { useAuthMode } from './authMode';
import { useCurrentUser } from './useCurrentUser';

const Setup = lazy(() => import('../features/setup/Setup'));
const Dashboard = lazy(() => import('../features/dashboard/Dashboard'));
const Traces = lazy(() => import('../features/traces/Traces'));
const Agents = lazy(() => import('../features/agents/Agents'));
const Suites = lazy(() => import('../features/suites/Suites'));
const Evaluators = lazy(() => import('../features/evaluators/Evaluators'));
const Runs = lazy(() => import('../features/runs/Runs'));
const Providers = lazy(() => import('../features/providers/Providers'));
const Proposals = lazy(() => import('../features/proposals/Proposals'));
const Settings = lazy(() => import('../features/settings/Settings'));
const Playground = lazy(() => import('../features/playground/Playground'));
const EvaluatorPlayground = lazy(() => import('../features/evaluator-playground/EvaluatorPlayground'));
const Signup = lazy(() => import('../features/auth/Signup'));
const Invites = lazy(() => import('../features/admin/Invites'));

export function AppRoutes() {
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
        <Route path="agents" element={wrap(<Agents />)} />
        <Route path="suites" element={wrap(<Suites />)} />
        <Route path="evaluators" element={wrap(<Evaluators />)} />
        <Route path="evaluators/:id" element={wrap(<Evaluators />)} />
        <Route path="runs" element={wrap(<Runs />)} />
        <Route path="playground" element={wrap(<Playground />)} />
        <Route path="evaluator-playground" element={wrap(<EvaluatorPlayground />)} />
        <Route path="providers" element={wrap(<Providers />)} />
        <Route path="settings" element={wrap(<Settings />)} />
        <Route path="proposals" element={wrap(<Proposals />)} />
        {isAdmin && <Route path="admin/invites" element={wrap(<Invites />)} />}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
