import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { agentCallsApi } from '../../../api/agent-calls';
import { autoTimeRange } from '../tracesMeta';
import type { TimeRange } from '../../../lib/timeRange';

/** On first load, set the time range to the smallest preset window containing the newest trace. */
export function useAutoDefaultRange(
  enabled: boolean,
  projectId: string | undefined,
  setTimeRange: (range: TimeRange) => void,
) {
  const applied = useRef(false);
  const { data } = useQuery({
    queryKey: ['traces-newest', projectId ?? null],
    queryFn: () => agentCallsApi.list({ pageSize: 1, includeSystemAgents: true, ...(projectId ? { projectId } : {}) }),
    enabled,
  });
  useEffect(() => {
    if (applied.current || !data) return;
    applied.current = true;
    setTimeRange(autoTimeRange(data.items[0]?.createdAt ?? null));
  }, [data, setTimeRange]);
}
