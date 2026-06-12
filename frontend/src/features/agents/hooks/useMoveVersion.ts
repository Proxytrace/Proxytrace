import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { agentsApi, agentVersionsApi } from '../../../api/agents';
import { QUERY_KEYS } from '../../../api/query-keys';

export const MOVE_CANDIDATE_FETCH_LIMIT = 500;

/** Candidate target agents for the move-version dialog (first page, capped). */
export function useMoveVersionCandidates(projectId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.agents(projectId),
    queryFn: () => agentsApi.list({ projectId, pageSize: MOVE_CANDIDATE_FETCH_LIMIT }),
  });
}

/** Moves a version to another agent; refreshes both agents' lists, then runs `onDone`. */
export function useMoveVersion(versionId: string, sourceAgentId: string, projectId: string, onDone: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (targetAgentId: string) => agentVersionsApi.move(versionId, targetAgentId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: QUERY_KEYS.agents(projectId) });
      await qc.invalidateQueries({ queryKey: QUERY_KEYS.agentVersions(sourceAgentId) });
      onDone();
    },
  });
}
