import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLingui } from '@lingui/react/macro';
import { emailSettingsApi, type UpdateEmailSettings } from '../../../api/emailSettings';
import { QUERY_KEYS } from '../../../api/query-keys';
import useToast from '../../../hooks/useToast';

export function useEmailSettings() {
  return useQuery({
    queryKey: QUERY_KEYS.emailSettings,
    queryFn: () => emailSettingsApi.get(),
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
