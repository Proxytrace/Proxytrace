import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setupApi } from '../../../api/setup';

/**
 * Wipes all runtime/trace data (keeps configuration). Invalidates the entire query cache —
 * the wipe touches every data-bearing view, and enumerating keys here rotted once already
 * (it still listed pre-dashboard-rework statistics keys that no longer exist).
 */
export function useCleanupNonModelData(onSuccess: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => setupApi.cleanupNonModelData(),
    onSuccess: () => {
      void qc.invalidateQueries();
      onSuccess();
    },
  });
}
