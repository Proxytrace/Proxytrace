import { useQuery } from '@tanstack/react-query';
import { providersApi } from '../../../api/providers';
import { QUERY_KEYS } from '../../../api/query-keys';
import { LIST_PAGE_SIZE } from '../../../lib/constants';

/** All providers for the master list. */
export function useProviders() {
  return useQuery({
    queryKey: QUERY_KEYS.providers,
    queryFn: () => providersApi.list({ pageSize: LIST_PAGE_SIZE }),
  });
}

/** Projects available to scope new API keys. */
export function useProviderProjects() {
  return useQuery({ queryKey: QUERY_KEYS.projects, queryFn: providersApi.getProjects });
}

/** Configured model endpoints for one provider. */
export function useProviderModels(providerId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.providerModels(providerId),
    queryFn: () => providersApi.getModels(providerId),
    enabled: !!providerId,
  });
}

/** Models the upstream endpoint advertises — only discovered while the add form is open. */
export function useAvailableModels(providerId: string, enabled: boolean) {
  return useQuery({
    queryKey: QUERY_KEYS.providerAvailableModels(providerId),
    queryFn: () => providersApi.getAvailableModels(providerId),
    enabled: enabled && !!providerId,
    retry: false,
  });
}

/** Proxytrace-issued API keys for one provider. */
export function useProviderKeys(providerId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.providerKeys(providerId),
    queryFn: () => providersApi.getKeys(providerId),
    enabled: !!providerId,
  });
}
