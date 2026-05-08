import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { statisticsApi } from '../../api/statistics';
import { QUERY_KEYS } from '../../api/query-keys';
import { useTraceStream, useProposalStream } from '../../api/event-stream';
import { rangeFrom, bucketFor, type RangeKey } from '../../lib/time-range';

export function useAgentStats(agentId: string) {
  const qc = useQueryClient();
  const [range, setRange] = useState<RangeKey>('7d');

  const params = useMemo(() => ({
    from: rangeFrom(range),
    to: new Date().toISOString(),
    bucket: bucketFor(range),
  }), [range]);

  const { data: overview, isLoading } = useQuery({
    queryKey: QUERY_KEYS.agentStatsOverview(agentId, range),
    queryFn: () => statisticsApi.agentOverview(agentId, params),
  });

  useTraceStream(useCallback((evt) => {
    if (evt.agentId !== agentId) return;
    qc.invalidateQueries({ queryKey: QUERY_KEYS.agentStatsOverview(agentId, range) });
  }, [agentId, range, qc]));

  useProposalStream(agentId, useCallback(() => {
    qc.invalidateQueries({ queryKey: QUERY_KEYS.agentStatsOverview(agentId, range) });
    qc.invalidateQueries({ queryKey: QUERY_KEYS.agentCounts(agentId) });
  }, [agentId, range, qc]));

  return { overview, isLoading, range, setRange };
}
