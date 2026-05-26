import { QueryClient } from '@tanstack/react-query';
import { configApi } from '../api/config';
import { QUERY_KEYS } from '../api/query-keys';
import { fetchAuthMode } from '../auth/authMode';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000, throwOnError: true } },
});

// Prefetch auth-mode so children can render synchronously.
queryClient.prefetchQuery({ queryKey: QUERY_KEYS.authMode, queryFn: fetchAuthMode, staleTime: Infinity });
queryClient.prefetchQuery({ queryKey: QUERY_KEYS.appConfig, queryFn: configApi.get, staleTime: Infinity });
