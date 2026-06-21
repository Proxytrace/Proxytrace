import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLingui } from '@lingui/react/macro';
import { emailSettingsApi, type UpdateEmailSettings } from '../../../api/emailSettings';
import { QUERY_KEYS } from '../../../api/query-keys';
import useToast from '../../../hooks/useToast';

export function useEmailSettings() {
  return useQuery({
    queryKey: QUERY_KEYS.emailSettings,
    // GET returns 204 (undefined) when never configured; React Query forbids an
    // undefined queryFn result, so normalise the "not configured" case to null.
    queryFn: async () => (await emailSettingsApi.get()) ?? null,
    retry: false,
  });
}

export function useUpdateEmailSettings() {
  const qc = useQueryClient();
  const { t } = useLingui();
  const { show: toast } = useToast();
  return useMutation({
    mutationFn: (body: UpdateEmailSettings) => emailSettingsApi.update(body),
    onSuccess: (saved) => {
      qc.setQueryData(QUERY_KEYS.emailSettings, saved);
      toast(t`Email settings saved`, 'success');
    },
  });
}

export function useSendTestEmail() {
  const { t } = useLingui();
  const { show: toast } = useToast();
  return useMutation({
    mutationFn: () => emailSettingsApi.sendTest(),
    onSuccess: () => toast(t`Test email sent`, 'success'),
  });
}
