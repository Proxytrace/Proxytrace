import { useQuery, useQueryClient } from '@tanstack/react-query';
import { statisticsApi } from '../../../api/statistics';
import { QUERY_KEYS } from '../../../api/query-keys';
import { useTraceStream } from '../../../api/event-stream';
import { rangeFrom, type RangeKey } from '../../../lib/time-range';

/**
 * Mean ± std distribution of an agent's calls over the selected range. Shares the range owned by
 * {@link useAgentStats} so the distribution widget tracks the performance card. Keyed on the range
 * only (not the drifting `to`), and invalidated live when a new trace lands for this agent.
 */
export function useAgentDistributions(agentId: string, range: RangeKey) {
  const qc = useQueryClient();

  const { data: distributions, isLoading } = useQuery({
    queryKey: QUERY_KEYS.agentStatsDistributions(agentId, range),
    queryFn: () =>
      statisticsApi.agentDistributions(agentId, { from: rangeFrom(range), to: new Date().toISOString() }),
  });

  useTraceStream((evt) => {
    if (evt.agentId !== agentId) return;
    qc.invalidateQueries({ queryKey: QUERY_KEYS.agentStatsDistributions(agentId, range) });
  });

  return { distributions, isLoading };
}
