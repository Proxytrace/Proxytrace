import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PagedResult } from './models';

export interface ProviderDto {
  id: string;
  name: string;
  endpoint: string;
  upstreamApiKey: string;
  organizationId: string;
  organizationName: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKeyDto {
  id: string;
  name: string;
  keyValue: string;
  projectId: string;
  projectName: string;
  providerId: string;
  providerName: string;
  createdAt: string;
}

export interface ProjectDto {
  id: string;
  name: string;
  organizationId: string;
  organizationName: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationDto {
  id: string;
  name: string;
}

export interface ModelEndpointDto {
  id: string;
  modelName: string;
  providerId: string;
  providerName: string;
  inputTokenCost: number | null;
  outputTokenCost: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateModelEndpointRequest {
  modelName: string;
  inputTokenCost: number | null;
  outputTokenCost: number | null;
}

export interface UpdateModelEndpointPricingRequest {
  inputTokenCost: number | null;
  outputTokenCost: number | null;
}

export interface CreateProviderRequest {
  name: string;
  endpoint: string;
  upstreamApiKey: string;
  organizationId: string;
}

export interface CreateApiKeyRequest {
  name: string;
  projectId: string;
}

@Injectable({ providedIn: 'root' })
export class ProvidersService {
  private readonly http = inject(HttpClient);

  getProviders(): Observable<PagedResult<ProviderDto>> {
    return this.http.get<PagedResult<ProviderDto>>('/api/providers');
  }

  createProvider(req: CreateProviderRequest): Observable<ProviderDto> {
    return this.http.post<ProviderDto>('/api/providers', req);
  }

  updateProvider(id: string, req: { name: string; endpoint: string; upstreamApiKey: string }): Observable<ProviderDto> {
    return this.http.put<ProviderDto>(`/api/providers/${id}`, req);
  }

  deleteProvider(id: string): Observable<void> {
    return this.http.delete<void>(`/api/providers/${id}`);
  }

  getModels(providerId: string): Observable<ModelEndpointDto[]> {
    return this.http.get<ModelEndpointDto[]>(`/api/providers/${providerId}/models`);
  }

  createModel(providerId: string, req: CreateModelEndpointRequest): Observable<ModelEndpointDto> {
    return this.http.post<ModelEndpointDto>(`/api/providers/${providerId}/models`, req);
  }

  updateModelPricing(providerId: string, endpointId: string, req: UpdateModelEndpointPricingRequest): Observable<ModelEndpointDto> {
    return this.http.put<ModelEndpointDto>(`/api/providers/${providerId}/models/${endpointId}`, req);
  }

  getKeys(providerId: string): Observable<ApiKeyDto[]> {
    return this.http.get<ApiKeyDto[]>(`/api/providers/${providerId}/keys`);
  }

  createKey(providerId: string, req: CreateApiKeyRequest): Observable<ApiKeyDto> {
    return this.http.post<ApiKeyDto>(`/api/providers/${providerId}/keys`, req);
  }

  deleteKey(providerId: string, keyId: string): Observable<void> {
    return this.http.delete<void>(`/api/providers/${providerId}/keys/${keyId}`);
  }

  getProjects(): Observable<PagedResult<ProjectDto>> {
    return this.http.get<PagedResult<ProjectDto>>('/api/projects');
  }

  getOrganizations(): Observable<PagedResult<OrganizationDto>> {
    return this.http.get<PagedResult<OrganizationDto>>('/api/organizations');
  }
}
