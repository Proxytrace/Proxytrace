import { api } from './client';
import type {
  ApiKeyDto, CreateApiKeyRequest, CreateModelEndpointRequest, CreateProviderRequest,
  ModelEndpointDto, ModelProviderKind,
  ProviderDto, ProvidersOverviewDto, UpdateModelEndpointPricingRequest,
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
  getAvailableModels: (providerId: string) => api.get<string[]>(`/api/providers/${providerId}/available-models`),
  createModel: (providerId: string, req: CreateModelEndpointRequest) =>
    api.post<ModelEndpointDto>(`/api/providers/${providerId}/models`, req),
  updateModelPricing: (providerId: string, endpointId: string, req: UpdateModelEndpointPricingRequest) =>
    api.put<ModelEndpointDto>(`/api/providers/${providerId}/models/${endpointId}`, req),
  deleteModel: (endpointId: string) =>
    api.del(`/api/providers/endpoints/${endpointId}`),

  createKey: (providerId: string, req: CreateApiKeyRequest) =>
    api.post<ApiKeyDto>(`/api/providers/${providerId}/keys`, req),
  deleteKey: (providerId: string, keyId: string) =>
    api.del(`/api/providers/${providerId}/keys/${keyId}`),
};
