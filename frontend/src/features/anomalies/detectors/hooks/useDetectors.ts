import { useQuery } from '@tanstack/react-query';
import { anomalyDetectorsApi } from '../../../../api/anomaly-detectors';
import { QUERY_KEYS } from '../../../../api/query-keys';
import useCurrentProject from '../../../../hooks/useCurrentProject';

/** Custom anomaly detectors for the current project. The list carries full detectors, so the edit
 * form reads straight from a list item — no per-detector detail fetch. */
export function useDetectors() {
  const { currentProjectId } = useCurrentProject();
  const query = useQuery({
    queryKey: QUERY_KEYS.anomalyDetectors(currentProjectId ?? undefined),
    queryFn: () => anomalyDetectorsApi.list(currentProjectId ?? ''),
    enabled: currentProjectId !== null,
  });
  return {
    detectors: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
