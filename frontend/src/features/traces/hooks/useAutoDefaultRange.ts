import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { agentCallsApi } from '../../../api/agent-calls';
import { autoPreset } from '../tracesMeta';

/** On first load, set the range preset to the smallest window containing the newest trace. */
export function useAutoDefaultRange(
  enabled: boolean,
  projectId: string | undefined,
  setRange: (key: string) => void,
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
    setRange(autoPreset(data.items[0]?.createdAt ?? null));
  }, [data, setRange]);
}
