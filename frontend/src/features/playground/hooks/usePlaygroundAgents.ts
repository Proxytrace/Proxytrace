import { useQuery } from '@tanstack/react-query';
import { agentsApi } from '../../../api/agents';
import { QUERY_KEYS } from '../../../api/query-keys';

const PICKER_PAGE_SIZE = 200;

/** Light agent list for the playground's agent picker. System agents (e.g. the internal Tracey
 *  agent) are filtered out — the picker only offers real, user-facing agents. */
export function usePlaygroundAgents(projectId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.agents(projectId),
    queryFn: () => agentsApi.list({ projectId, pageSize: PICKER_PAGE_SIZE }),
    select: (data) => ({ ...data, items: data.items.filter((a) => !a.isSystemAgent) }),
  });
}
