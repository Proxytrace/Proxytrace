import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { auditLogApi } from '../../../api/audit-log';
import { QUERY_KEYS } from '../../../api/query-keys';
import { DEFAULT_PAGE_SIZE } from '../../../lib/constants';
import type { AuditLogFilter } from '../../../api/models';

export const PAGE_SIZE = DEFAULT_PAGE_SIZE;
export const PAGE_SIZE_OPTIONS = [20, 50, 100, 200] as const;

export function useAuditLogQuery(filter: AuditLogFilter, enabled = true) {
  const query = useQuery({
    queryKey: QUERY_KEYS.auditLog(filter),
    queryFn: () => auditLogApi.list(filter),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
    enabled,
  });

  return {
    entries: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    isFetching: query.isFetching,
    isLoading: query.isLoading,
  };
}

export function useAuditLogEntry(id: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.auditLogEntry(id ?? ''),
    queryFn: () => auditLogApi.get(id ?? ''),
    enabled: !!id,
  });
}
