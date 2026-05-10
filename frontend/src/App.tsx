import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { Shell } from './components/layout/Shell';
import { ToastProvider } from './components/ui/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProjectProvider } from './contexts/ProjectContext';
import { setupApi } from './api/setup';

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

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000, throwOnError: true } },
});

function PageLoader() {
  return (
    <div className="flex items-center justify-center flex-1 text-muted text-[13px]">
      Loading…
    </div>
  );
}

function AppRoutes() {
  const { data: setupStatus } = useQuery({
    queryKey: ['setup-status'],
    queryFn: setupApi.getStatus,
    staleTime: Infinity,
  });

  // Still loading setup status — show nothing to avoid flash
  if (setupStatus === undefined) return <PageLoader />;

  const wrap = (el: React.ReactNode) => (
    <ErrorBoundary><Suspense fallback={<PageLoader />}>{el}</Suspense></ErrorBoundary>
  );

  return (
    <Routes>
      <Route
        path="/setup"
        element={
          setupStatus.isConfigured
            ? <Navigate to="/dashboard" replace />
            : wrap(<Setup />)
        }
      />
      <Route
        path="/"
        element={setupStatus.isConfigured ? <ProjectProvider><Shell /></ProjectProvider> : <Navigate to="/setup" replace />}
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
          <Route path="proposals" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><Proposals /></Suspense></ErrorBoundary>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
