import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { errorLogApi } from '../../../api/error-log';
import { QUERY_KEYS } from '../../../api/query-keys';
import type { ApplicationErrorFilter } from '../../../api/models';

/**
 * Paginated application-error list. Refetches on window focus so an operator returning to the
 * tab sees fresh errors without a manual reload (no SSE for this admin-only debug surface).
 */
export function useErrorLogQuery(filter: ApplicationErrorFilter) {
  const query = useQuery({
    queryKey: QUERY_KEYS.errorLog(filter),
    queryFn: () => errorLogApi.list(filter),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
  });

  return {
    errors: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    isFetching: query.isFetching,
    isLoading: query.isLoading,
  };
}
