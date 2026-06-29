import { useQuery, useQueryClient } from '@tanstack/react-query';
import { statisticsApi } from '../../api/statistics';
import { QUERY_KEYS } from '../../api/query-keys';
import { useTraceStream, useProposalStream } from '../../api/event-stream';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { rangeFrom, bucketFor, type RangeKey } from '../../lib/time-range';

export function useAgentStats(agentId: string) {
  const qc = useQueryClient();
  // Persisted so the chosen window survives switching agents (AgentDetail remounts per id) and reloads.
  const [range, setRange] = useLocalStorageState<RangeKey>('agent-stats-range', '7d');

  const params = {
    from: rangeFrom(range),
    to: new Date().toISOString(),
    bucket: bucketFor(range),
  };

  const { data: overview, isLoading } = useQuery({
    queryKey: QUERY_KEYS.agentStatsOverview(agentId, range),
    queryFn: () => statisticsApi.agentOverview(agentId, params),
  });

  useTraceStream((evt) => {
    if (evt.agentId !== agentId) return;
    qc.invalidateQueries({ queryKey: QUERY_KEYS.agentStatsOverview(agentId, range) });
  });

  useProposalStream(agentId, () => {
    qc.invalidateQueries({ queryKey: QUERY_KEYS.agentStatsOverview(agentId, range) });
    qc.invalidateQueries({ queryKey: QUERY_KEYS.agentCounts(agentId) });
  });

  return { overview, isLoading, range, setRange };
}
