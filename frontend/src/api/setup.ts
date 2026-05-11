import { api } from './client';
import { ModelProviderKind } from './models';

export interface SetupStatusDto {
  isConfigured: boolean;
}

export interface CompleteSetupRequest {
  providerName: string;
  providerEndpoint: string;
  providerUpstreamApiKey: string;
  providerKind: ModelProviderKind;
  modelName: string;
  inputTokenCost: number | null;
  outputTokenCost: number | null;
  projectName: string;
  apiKeyName: string;
}

export interface CompleteSetupResponse {
  providerId: string;
  endpointId: string;
  projectId: string;
  apiKeyValue: string;
}

export interface ProviderConnectionRequest {
  providerName: string;
  providerEndpoint: string;
  providerUpstreamApiKey: string;
  providerKind: ModelProviderKind;
}

export interface TestConnectionResponse {
  success: boolean;
  error: string | null;
}

export interface ListModelsResponse {
  models: string[];
}

export const setupApi = {
  getStatus: () => api.get<SetupStatusDto>('/api/setup/status'),
  complete: (req: CompleteSetupRequest) =>
    api.post<CompleteSetupResponse>('/api/setup/complete', req),
  testConnection: (req: ProviderConnectionRequest) =>
    api.post<TestConnectionResponse>('/api/setup/test-connection', req),
  listModels: (req: ProviderConnectionRequest) =>
    api.post<ListModelsResponse>('/api/setup/list-models', req),
  cleanupNonModelData: () => api.post<void>('/api/setup/cleanup'),
};
