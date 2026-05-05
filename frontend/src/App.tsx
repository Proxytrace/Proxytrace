import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { Shell } from './components/layout/Shell';
import { ToastProvider } from './components/ui/Toast';

const Dashboard = lazy(() => import('./features/dashboard/Dashboard'));
const Traces = lazy(() => import('./features/traces/Traces'));
const Agents = lazy(() => import('./features/agents/Agents'));
const Suites = lazy(() => import('./features/suites/Suites'));
const Evaluators = lazy(() => import('./features/evaluators/Evaluators'));
const Runs = lazy(() => import('./features/runs/Runs'));
const Providers = lazy(() => import('./features/providers/Providers'));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)', fontSize: '13px' }}>
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
              <Route path="dashboard" element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
              <Route path="traces" element={<Suspense fallback={<PageLoader />}><Traces /></Suspense>} />
              <Route path="agents" element={<Suspense fallback={<PageLoader />}><Agents /></Suspense>} />
              <Route path="suites" element={<Suspense fallback={<PageLoader />}><Suites /></Suspense>} />
              <Route path="evaluators" element={<Suspense fallback={<PageLoader />}><Evaluators /></Suspense>} />
              <Route path="runs" element={<Suspense fallback={<PageLoader />}><Runs /></Suspense>} />
              <Route path="providers" element={<Suspense fallback={<PageLoader />}><Providers /></Suspense>} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
