import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLingui } from '@lingui/react/macro';
import { outlierSettingsApi, type OutlierSettings } from '../../../api/outlierSettings';
import { QUERY_KEYS } from '../../../api/query-keys';
import useToast from '../../../hooks/useToast';

export function useOutlierSettings() {
  return useQuery({
    queryKey: QUERY_KEYS.outlierSettings,
    queryFn: () => outlierSettingsApi.get(),
    retry: false,
  });
}

export function useUpdateOutlierSettings() {
  const qc = useQueryClient();
  const { t } = useLingui();
  const { show: toast } = useToast();
  return useMutation({
    mutationFn: (body: OutlierSettings) => outlierSettingsApi.update(body),
    onSuccess: (saved) => {
      qc.setQueryData(QUERY_KEYS.outlierSettings, saved);
      toast(t`Outlier settings saved`, 'success');
    },
  });
}
