import { api } from './client';
import { ModelProviderKind } from './models';

export interface SetupStatusDto {
  isConfigured: boolean;
}

export interface CompleteSetupRequest {
  userName: string;
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
  userId: string;
  providerId: string;
  endpointId: string;
  projectId: string;
  apiKeyValue: string;
}

export const setupApi = {
  getStatus: () => api.get<SetupStatusDto>('/api/setup/status'),
  complete: (req: CompleteSetupRequest) =>
    api.post<CompleteSetupResponse>('/api/setup/complete', req),
  cleanupNonModelData: () => api.post<void>('/api/setup/cleanup'),
};
