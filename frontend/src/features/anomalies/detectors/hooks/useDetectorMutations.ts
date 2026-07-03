import { useMutation, useQueryClient } from '@tanstack/react-query';
import { anomalyDetectorsApi } from '../../../../api/anomaly-detectors';
import { QUERY_KEYS } from '../../../../api/query-keys';
import useCurrentProject from '../../../../hooks/useCurrentProject';
import type {
  CreateCustomAnomalyDetectorRequest,
  UpdateCustomAnomalyDetectorRequest,
} from '../../../../api/models';

/** Create / update / delete for custom anomaly detectors. Each invalidates the detectors list for
 * the current project (mutations invalidate, they don't refetch by hand). */
export function useDetectorMutations() {
  const qc = useQueryClient();
  const { currentProjectId } = useCurrentProject();
  const invalidate = () => qc.invalidateQueries({ queryKey: QUERY_KEYS.anomalyDetectorsRoot });

  const create = useMutation({
    mutationFn: (request: CreateCustomAnomalyDetectorRequest) => anomalyDetectorsApi.create(request),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, request }: { id: string; request: UpdateCustomAnomalyDetectorRequest }) =>
      anomalyDetectorsApi.update(id, request),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => anomalyDetectorsApi.delete(id),
    onSuccess: invalidate,
  });

  return { create, update, remove, projectId: currentProjectId };
}
