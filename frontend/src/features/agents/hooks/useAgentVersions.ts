import { useQuery } from '@tanstack/react-query';
import { agentsApi } from '../../../api/agents';
import { QUERY_KEYS } from '../../../api/query-keys';

/** Version history for an agent (shared cache across the header pill and VersionsWidget). */
export function useAgentVersions(agentId: string) {
  const query = useQuery({
    queryKey: QUERY_KEYS.agentVersions(agentId),
    queryFn: () => agentsApi.listVersions(agentId),
  });
  const versions = query.data ?? [];
  const latestVersion = versions.reduce((max, v) => Math.max(max, v.versionNumber), 0);
  return { versions, latestVersion, isLoading: query.isLoading };
}
