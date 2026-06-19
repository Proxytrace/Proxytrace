import { api, qs, type RequestOptions } from './client';
import type { OptimizationProposalDto, ProposalArtifactDto, ProposalStatus } from './models';

export const proposalsApi = {
  getAll: (params?: { agentId?: string; projectId?: string }) =>
    api.get<OptimizationProposalDto[]>(`/api/proposals${qs(params ?? {})}`),
  get: (id: string, opts?: RequestOptions) =>
    api.get<OptimizationProposalDto>(`/api/proposals/${id}`, opts),
  updateStatus: (id: string, status: ProposalStatus) =>
    api.patch<OptimizationProposalDto>(`/api/proposals/${id}/status`, { status }),
  getArtifact: (id: string) =>
    api.get<ProposalArtifactDto>(`/api/proposals/${id}/artifact`),
};
