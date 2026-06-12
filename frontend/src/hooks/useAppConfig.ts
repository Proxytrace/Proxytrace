import { useQuery } from '@tanstack/react-query';
import { configApi } from '../api/config';
import { QUERY_KEYS } from '../api/query-keys';

/**
 * Runtime app configuration from `/api/config` (kiosk mode, version, advertised
 * ingestion-proxy URL). Static for the lifetime of the backend process, hence
 * `staleTime: Infinity`; App.tsx prefetches it on boot so reads resolve instantly.
 */
export function useAppConfig() {
  return useQuery({
    queryKey: QUERY_KEYS.appConfig,
    queryFn: configApi.get,
    staleTime: Infinity,
  });
}
