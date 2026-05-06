import { api, qs } from './client';
import type { OptimizationProposalDto, ProposalStatus } from './models';

export const proposalsApi = {
  getAll: (params?: { agentId?: string }) =>
    api.get<OptimizationProposalDto[]>(`/api/proposals${qs(params ?? {})}`),
  updateStatus: (id: string, status: ProposalStatus) =>
    api.patch<OptimizationProposalDto>(`/api/proposals/${id}/status`, { status }),
};
