import { useQuery } from '@tanstack/react-query';
import { anomaliesApi } from '../../../api/anomalies';
import { QUERY_KEYS } from '../../../api/query-keys';
import { OutlierFlag } from '../../../lib/outliers';
import type { AgentCallDto, CustomAnomalyHitDto } from '../../../api/models';

/**
 * Custom-detector attributions for one trace — the detail drawer's anomaly banner. Fetched only
 * when the call carries the {@link OutlierFlag.CustomAnomaly} bit (statistical-only outliers have
 * no attribution rows by definition). A stale id 404s silently rather than tripping the global
 * error boundary — the banner simply shows no detector rows.
 */
export function useTraceAnomalyHits(trace: AgentCallDto): CustomAnomalyHitDto[] {
  const hasCustomFlag = (trace.outlierFlags & OutlierFlag.CustomAnomaly) !== 0;

  const query = useQuery({
    queryKey: QUERY_KEYS.anomalyHits(trace.id),
    queryFn: () => anomaliesApi.hitsForCall(trace.id, { silentStatuses: [404] }),
    enabled: hasCustomFlag,
    throwOnError: false,
    retry: false,
  });

  return query.data ?? [];
}
