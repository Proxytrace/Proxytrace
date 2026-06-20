import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLingui } from '@lingui/react/macro';
import { searchApi, type SearchIndexingSettings } from '../../../api/search';
import { QUERY_KEYS } from '../../../api/query-keys';
import useToast from '../../../hooks/useToast';

/** Indexing settings for one project. */
export function useSearchSettings(projectId: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.searchSettings(projectId ?? 'none'),
    queryFn: () => searchApi.getSettings(projectId ?? ''),
    enabled: !!projectId,
    retry: false,
  });
}

/** Live index status, polled every 5s. */
export function useSearchStatus(projectId: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.searchStatus(projectId ?? 'none'),
    queryFn: () => searchApi.getStatus(projectId ?? ''),
    enabled: !!projectId,
    refetchInterval: 5000,
    retry: false,
  });
}

/** Saves indexing settings; patches the settings cache on success. */
export function useUpdateSearchSettings() {
  const qc = useQueryClient();
  const { t } = useLingui();
  const { show: toast } = useToast();
  return useMutation({
    mutationFn: (args: { projectId: string; next: SearchIndexingSettings }) =>
      searchApi.updateSettings(args.projectId, args.next),
    onSuccess: (saved, args) => {
      qc.setQueryData(QUERY_KEYS.searchSettings(args.projectId), saved);
      toast(t`Search settings saved`, 'success');
    },
  });
}

/** Triggers a reindex; refreshes the status query. */
export function useReindex() {
  const qc = useQueryClient();
  const { t } = useLingui();
  const { show: toast } = useToast();
  return useMutation({
    mutationFn: (projectId: string) => searchApi.reindex(projectId),
    onSuccess: (_result, projectId) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.searchStatus(projectId) });
      toast(t`Reindex started`, 'success');
    },
  });
}
