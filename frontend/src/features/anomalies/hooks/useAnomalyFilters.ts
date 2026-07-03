import { useCallback, useState } from 'react';
import { useLocalStorageState } from '../../../hooks/useLocalStorageState';
import { type TimeRange } from '../../../lib/timeRange';
import { isValidTimeRange } from '../../traces/hooks/useTraceFilters';
import type { StatisticsBucket } from '../../../lib/time-range';

/**
 * Owns the persisted anomaly-dashboard filter bar so the page survives refresh / navigation.
 *
 * `timeRange` and `bucket` are project-agnostic (fixed keys). `agentFilter` is **project-scoped** —
 * agent ids belong to one project and the page stays mounted across project switches — so it is
 * keyed per project and re-read on switch via the render-time prev-value pattern (no effect), the
 * same shape as [[useTraceFilters]].
 */

const DEFAULT_RANGE: TimeRange = { kind: 'preset', preset: '24h' };
const BUCKETS = new Set<StatisticsBucket>(['fiveMinutes', 'hourly', 'daily']);

export function anomalyAgentFilterKey(projectId: string): string {
  return `anomalies.agentFilter.${projectId}`;
}

function readAgentFilter(projectId: string | null): string {
  if (projectId === null) return '';
  try {
    return localStorage.getItem(anomalyAgentFilterKey(projectId)) ?? '';
  } catch {
    return '';
  }
}

export interface AnomalyFilters {
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
  bucket: StatisticsBucket;
  setBucket: (bucket: StatisticsBucket) => void;
  agentFilter: string;
  setAgentFilter: (id: string) => void;
}

export function useAnomalyFilters(projectId: string | null): AnomalyFilters {
  const [rawRange, setTimeRange] = useLocalStorageState<TimeRange>('anomalies.timeRange', DEFAULT_RANGE);
  const timeRange = isValidTimeRange(rawRange) ? rawRange : DEFAULT_RANGE;

  const [rawBucket, setBucketState] = useLocalStorageState<StatisticsBucket>('anomalies.bucket', 'hourly');
  const bucket = BUCKETS.has(rawBucket) ? rawBucket : 'hourly';

  // Project-scoped agent filter: re-read whenever the active project changes (the page is not
  // remounted on switch), written under the project's own key. Re-read during render via the
  // prev-value pattern — no effect (see useTraceFilters).
  const [agentFilter, setAgentFilterState] = useState(() => readAgentFilter(projectId));
  const [trackedProjectId, setTrackedProjectId] = useState(projectId);
  if (projectId !== trackedProjectId) {
    setTrackedProjectId(projectId);
    setAgentFilterState(readAgentFilter(projectId));
  }

  const setAgentFilter = useCallback(
    (id: string) => {
      setAgentFilterState(id);
      if (projectId === null) return;
      try {
        if (id) localStorage.setItem(anomalyAgentFilterKey(projectId), id);
        else localStorage.removeItem(anomalyAgentFilterKey(projectId));
      } catch {
        // storage unavailable or over quota — keep the in-memory value only
      }
    },
    [projectId],
  );

  return { timeRange, setTimeRange, bucket, setBucket: setBucketState, agentFilter, setAgentFilter };
}
