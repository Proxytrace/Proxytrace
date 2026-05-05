import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { Shell } from './components/layout/Shell';
import { ToastProvider } from './components/ui/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';

const Dashboard = lazy(() => import('./features/dashboard/Dashboard'));
const Traces = lazy(() => import('./features/traces/Traces'));
const Agents = lazy(() => import('./features/agents/Agents'));
const Suites = lazy(() => import('./features/suites/Suites'));
const Evaluators = lazy(() => import('./features/evaluators/Evaluators'));
const Runs = lazy(() => import('./features/runs/Runs'));
const Providers = lazy(() => import('./features/providers/Providers'));

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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Shell />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><Dashboard /></Suspense></ErrorBoundary>} />
              <Route path="traces" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><Traces /></Suspense></ErrorBoundary>} />
              <Route path="agents" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><Agents /></Suspense></ErrorBoundary>} />
              <Route path="suites" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><Suites /></Suspense></ErrorBoundary>} />
              <Route path="evaluators" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><Evaluators /></Suspense></ErrorBoundary>} />
              <Route path="runs" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><Runs /></Suspense></ErrorBoundary>} />
              <Route path="providers" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><Providers /></Suspense></ErrorBoundary>} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
