import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchApi } from '../../../api/search';
import type { SearchHit, SearchKind } from '../../../api/search';
import { QUERY_KEYS } from '../../../api/query-keys';
import { resolveGroupOrder } from '../searchMeta';

interface UseSearchQueryOptions {
  projectId: string;
  debounced: string;
  kinds?: SearchKind[];
  showRecents: boolean;
  recentLimit: number;
  open: boolean;
}

interface UseSearchQueryResult {
  hits: SearchHit[];
  groupOrder: { kind: SearchKind; label: string }[];
  allowedKinds: Set<SearchKind>;
  isRecentMode: boolean;
  fetching: boolean;
  recentErrored: boolean;
}

export function useSearchQuery({
  projectId,
  debounced,
  kinds,
  showRecents,
  recentLimit,
  open,
}: UseSearchQueryOptions): UseSearchQueryResult {
  const groupOrder = useMemo(() => resolveGroupOrder(kinds), [kinds]);
  const allowedKinds = useMemo(() => new Set(groupOrder.map(g => g.kind)), [groupOrder]);
  const recentKinds = useMemo(() => groupOrder.map(g => g.kind), [groupOrder]);

  const isRecentMode = debounced.length === 0;
  const searchEnabled = debounced.length >= 2;
  const recentEnabled = showRecents && open && isRecentMode;

  const searchQuery = useQuery({
    queryKey: QUERY_KEYS.search(projectId, debounced),
    queryFn: () => searchApi.search(projectId, debounced),
    enabled: searchEnabled,
    staleTime: 30_000,
  });

  const recentQuery = useQuery({
    queryKey: QUERY_KEYS.searchRecent(projectId, recentKinds, recentLimit),
    queryFn: () => searchApi.recent(projectId, recentKinds, recentLimit),
    enabled: recentEnabled,
    staleTime: 15_000,
    retry: false,
  });

  const sourceHits = useMemo<SearchHit[]>(() => {
    if (isRecentMode) return recentQuery.data?.hits ?? [];
    return searchQuery.data?.hits ?? [];
  }, [isRecentMode, recentQuery.data, searchQuery.data]);

  const hits = useMemo(
    () => sourceHits.filter(h => allowedKinds.has(h.kind)),
    [sourceHits, allowedKinds],
  );

  const fetching = isRecentMode ? recentQuery.isFetching : searchQuery.isFetching;
  const recentErrored = isRecentMode && recentQuery.isError;

  return { hits, groupOrder, allowedKinds, isRecentMode, fetching, recentErrored };
}
