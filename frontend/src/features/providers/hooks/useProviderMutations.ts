import { useMutation, useQueryClient } from '@tanstack/react-query';
import { providersApi } from '../../../api/providers';
import { QUERY_KEYS } from '../../../api/query-keys';
import type {
  CreateApiKeyRequest, CreateModelEndpointRequest, CreateProviderRequest,
  ModelProviderKind,
} from '../../../api/models';

/** Creates a provider; invalidates the list. Caller selects the new provider via `mutate`'s onSuccess. */
export function useCreateProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: CreateProviderRequest) => providersApi.create(req),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.providersOverview }),
  });
}

/** Updates a provider's kind, preserving its other fields. */
export function useUpdateProviderKind() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { provider: { id: string; name: string; endpoint: string; upstreamApiKey: string }; kind: ModelProviderKind }) =>
      providersApi.update(args.provider.id, {
        name: args.provider.name,
        endpoint: args.provider.endpoint,
        upstreamApiKey: args.provider.upstreamApiKey,
        kind: args.kind,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.providersOverview }),
  });
}

/** Deletes a provider; invalidates the list. Caller resets selection via `mutate`'s onSuccess. */
export function useDeleteProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (providerId: string) => providersApi.delete(providerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.providersOverview }),
  });
}

/** Adds a model endpoint to a provider. */
export function useCreateModel(providerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: CreateModelEndpointRequest) => providersApi.createModel(providerId, req),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.providersOverview }),
  });
}

/** Deletes a model endpoint by id. */
export function useDeleteModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (endpointId: string) => providersApi.deleteModel(endpointId),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.providersOverview }),
  });
}

/** Generates a new Proxytrace API key for a provider. */
export function useCreateKey(providerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: CreateApiKeyRequest) => providersApi.createKey(providerId, req),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.providersOverview }),
  });
}

/** Revokes an API key by id. */
export function useDeleteKey(providerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (keyId: string) => providersApi.deleteKey(providerId, keyId),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.providersOverview }),
  });
}

/** Re-discovers a provider's models and refreshes pricing; invalidates the overview. */
export function useReloadProvider(providerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => providersApi.reload(providerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.providersOverview }),
  });
}
