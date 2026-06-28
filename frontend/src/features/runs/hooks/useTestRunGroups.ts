import { useInfiniteQuery } from '@tanstack/react-query';
import { testRunGroupsApi } from '../../../api/test-run-groups';
import { QUERY_KEYS } from '../../../api/query-keys';
import useCurrentProject from '../../../hooks/useCurrentProject';

/** Runs are loaded a page at a time; the rail shows a **Load more** button until the list is exhausted. */
const PAGE_SIZE = 20;

/**
 * Paged group list for the current project (optionally filtered by agent), newest first. Loads one
 * page up front and exposes {@link loadMore} for the rail's button. Live runs update via the group SSE
 * stream (see {@link useRunGroupStream}), which patches the detail cache and invalidates this list's
 * prefix on completion — there is no polling here (BEST_PRACTICES §3.2: SSE patches, never interval-refetch).
 */
export function useTestRunGroups(agentFilter: string, includeSystem = false) {
  const { currentProjectId } = useCurrentProject();
  const projectId = currentProjectId ?? undefined;

  const query = useInfiniteQuery({
    queryKey: QUERY_KEYS.testRunGroups(agentFilter, projectId, includeSystem),
    queryFn: ({ pageParam }) => testRunGroupsApi.list({
      agentId: agentFilter || undefined,
      projectId: agentFilter ? undefined : projectId,
      includeSystem: includeSystem || undefined,
      page: pageParam,
      pageSize: PAGE_SIZE,
    }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.items.length, 0);
      return loaded < lastPage.total ? allPages.length + 1 : undefined;
    },
    enabled: currentProjectId !== null,
  });

  return {
    groups: query.data?.pages.flatMap(page => page.items) ?? [],
    isLoading: query.isLoading,
    hasMore: query.hasNextPage,
    loadMore: () => { void query.fetchNextPage(); },
    isLoadingMore: query.isFetchingNextPage,
  };
}
