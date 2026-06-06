import { useQuery } from '@tanstack/react-query';
import { testSuitesApi } from '../../../api/test-suites';
import { QUERY_KEYS } from '../../../api/query-keys';
import useCurrentProject from '../../../hooks/useCurrentProject';

/**
 * Resolves test-suite ids to their display names for the current project. The board labels
 * each theory with the suite it is (or will be) validated against.
 */
export function useSuiteNames(): (suiteId: string) => string | undefined {
  const { currentProjectId } = useCurrentProject();
  const projectId = currentProjectId ?? undefined;

  const { data } = useQuery({
    queryKey: QUERY_KEYS.testSuites(undefined, projectId),
    queryFn: () => testSuitesApi.list({ projectId, pageSize: 200 }),
    enabled: currentProjectId !== null,
    select: (page) => new Map(page.items.map((s) => [s.id, s.name])),
  });

  return (suiteId: string) => data?.get(suiteId);
}
