import { useQuery } from '@tanstack/react-query';
import { anomaliesApi } from '../../../api/anomalies';
import { QUERY_KEYS } from '../../../api/query-keys';
import useCurrentProject from '../../../hooks/useCurrentProject';
import type { StatisticsBucket } from '../../../lib/time-range';
import { resolveTimelineWindow } from '../anomaliesMeta';
import { type TimeRange } from '../../../lib/timeRange';

/**
 * Sparse per-(bucket, agent) anomaly counts for the timeline plot, scoped to the current project and
 * the selected window/bucket/agent. The window is resolved to concrete `from`/`to` here (the API
 * requires both) and the query is keyed on the resolved params so a window change refetches.
 */
export function useAnomalyTimeline(timeRange: TimeRange, bucket: StatisticsBucket, agentFilter: string) {
  const { currentProjectId } = useCurrentProject();
  const { from, to } = resolveTimelineWindow(timeRange);

  const params = {
    from,
    to,
    bucket,
    projectId: currentProjectId ?? undefined,
    ...(agentFilter ? { agentId: agentFilter } : {}),
  };

  const query = useQuery({
    queryKey: QUERY_KEYS.anomalyTimeline(params),
    queryFn: () => anomaliesApi.timeline(params),
    enabled: currentProjectId !== null,
  });

  return {
    rows: query.data ?? [],
    from,
    to,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
