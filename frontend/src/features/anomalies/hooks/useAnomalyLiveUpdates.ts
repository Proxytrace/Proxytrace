import { useQueryClient } from '@tanstack/react-query';
import { useAnomalyStream, useTraceStream } from '../../../api/event-stream';
import { QUERY_KEYS } from '../../../api/query-keys';
import useCurrentProject from '../../../hooks/useCurrentProject';

/**
 * Keeps the anomaly dashboard live. Two SSE sources feed it — the trace stream (a newly ingested
 * call may be statistically flagged) and the custom-detector `anomaly-flagged` stream — and both
 * invalidate the recent-list and timeline query prefixes for the current project (SSE invalidates,
 * never refetch-loops; see DESIGN.md §8). Events for other projects are ignored. A failing/absent
 * stream simply yields no events, so the page never breaks if the stream endpoint is unavailable.
 */
export function useAnomalyLiveUpdates() {
  const qc = useQueryClient();
  const { currentProjectId } = useCurrentProject();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: QUERY_KEYS.anomaliesRecentRoot });
    qc.invalidateQueries({ queryKey: QUERY_KEYS.anomalyTimelineRoot });
  };

  useTraceStream(evt => {
    if (currentProjectId && evt.projectId !== currentProjectId) return;
    invalidate();
  });

  useAnomalyStream(currentProjectId ?? undefined, evt => {
    if (currentProjectId && evt.projectId !== currentProjectId) return;
    invalidate();
  });
}
