import { useQuery } from '@tanstack/react-query';
import { api } from './client';
import { QUERY_KEYS } from './query-keys';
import { useCurrentUser } from '../auth/useCurrentUser';

/** Update-check status served by `GET /api/updates` (admin-only). */
export interface UpdateStatusDto {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseUrl: string | null;
  checkedAt: string | null;
}

export const updatesApi = {
  get: () => api.get<UpdateStatusDto>('/api/updates', { silentStatuses: [403] }),
};

/**
 * The latest known update status. The backend refreshes daily, so the query is
 * cached for six hours; it only runs for admins (the endpoint is admin-only).
 * Purely informational — failures never bubble to the error boundary.
 */
export function useUpdateStatus() {
  const user = useCurrentUser();
  return useQuery({
    queryKey: QUERY_KEYS.updates,
    queryFn: updatesApi.get,
    enabled: user?.role === 'Admin',
    staleTime: 6 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    throwOnError: false,
  });
}
