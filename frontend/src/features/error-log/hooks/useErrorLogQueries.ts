import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { errorLogApi } from '../../../api/error-log';
import { QUERY_KEYS } from '../../../api/query-keys';
import { DEFAULT_PAGE_SIZE } from '../../../lib/constants';
import type { ApplicationErrorFilter } from '../../../api/models';

/** Default page size; the user can override it via the page-size selector. */
export const PAGE_SIZE = DEFAULT_PAGE_SIZE;

/** Selectable page sizes for the error-log table. */
export const PAGE_SIZE_OPTIONS = [20, 50, 100, 200] as const;

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
