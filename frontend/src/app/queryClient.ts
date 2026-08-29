import { MutationCache, QueryClient } from '@tanstack/react-query';
import { ReadOnlyModeError } from '../api/client';
import { showToast } from '../components/ui/Toast';
import { fetchAuthMode } from '../auth/authMode';
import { configApi } from '../api/config';
import { QUERY_KEYS } from '../api/query-keys';

// A mutation refused by read-only mode is an expected outcome of the kiosk demo, not a failure:
// tell the user in a neutral toast rather than the red error one. Only on the mutation cache —
// mutations are user-initiated, so this cannot fire for a background query.
function handleReadOnlyError(error: unknown): void {
  if (error instanceof ReadOnlyModeError) showToast(error.message, 'info');
}

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000, throwOnError: true } },
  mutationCache: new MutationCache({ onError: handleReadOnlyError }),
});

// Prefetch auth-mode + app config so children can render synchronously.
queryClient.prefetchQuery({ queryKey: QUERY_KEYS.authMode, queryFn: fetchAuthMode, staleTime: Infinity });
queryClient.prefetchQuery({ queryKey: QUERY_KEYS.appConfig, queryFn: configApi.get, staleTime: Infinity });
