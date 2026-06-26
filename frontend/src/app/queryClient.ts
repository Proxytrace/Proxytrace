import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { UpgradeRequiredError } from '../api/client';
import { showUpgradeModal } from '../components/license/UpgradeModal';
import { fetchAuthMode } from '../auth/authMode';
import { configApi } from '../api/config';
import { QUERY_KEYS } from '../api/query-keys';

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

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000, throwOnError: true } },
  queryCache: new QueryCache({ onError: handleUpgradeError }),
  mutationCache: new MutationCache({ onError: handleUpgradeError }),
});

// Prefetch auth-mode + app config so children can render synchronously.
queryClient.prefetchQuery({ queryKey: QUERY_KEYS.authMode, queryFn: fetchAuthMode, staleTime: Infinity });
queryClient.prefetchQuery({ queryKey: QUERY_KEYS.appConfig, queryFn: configApi.get, staleTime: Infinity });
