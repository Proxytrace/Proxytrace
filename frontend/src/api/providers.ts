import { api } from './client';
import type {
  ApiKeyDto, CreateApiKeyRequest, CreateProviderRequest,
  ModelEndpointDto, ModelProviderKind,
  ProviderDto, ProvidersOverviewDto,
} from './models';

export const providersApi = {
  /** Page payload: every provider with embedded models + keys, plus projects, in one request. */
  overview: () => api.get<ProvidersOverviewDto>('/api/providers/overview'),
  get: (id: string) => api.get<ProviderDto>(`/api/providers/${id}`),
  create: (req: CreateProviderRequest) => api.post<ProviderDto>('/api/providers', req),
  update: (id: string, req: { name: string; endpoint: string; upstreamApiKey: string; kind: ModelProviderKind }) =>
    api.put<ProviderDto>(`/api/providers/${id}`, req),
  delete: (id: string) => api.del(`/api/providers/${id}`),

  getAllModels: () => api.get<ModelEndpointDto[]>('/api/model-endpoints'),
  deleteModel: (endpointId: string) =>
    api.del(`/api/providers/endpoints/${endpointId}`),
  reload: (providerId: string) =>
    api.post<ModelEndpointDto[]>(`/api/providers/${providerId}/reload`, {}),

  createKey: (providerId: string, req: CreateApiKeyRequest) =>
    api.post<ApiKeyDto>(`/api/providers/${providerId}/keys`, req),
  deleteKey: (providerId: string, keyId: string) =>
    api.del(`/api/providers/${providerId}/keys/${keyId}`),
};
