import { api } from './client';

export interface InviteRow {
  id: string;
  email: string;
  role: 'Viewer' | 'Member' | 'Admin';
  expiresAt: string;
  consumedAt: string | null;
}

export interface CreateInviteRequest {
  email: string;
  role: InviteRow['role'];
}

export interface CreateInviteResponse {
  token: string;
  url: string;
  expiresAt: string;
}

export const invitesApi = {
  list: () => api.get<InviteRow[]>('/api/auth/invites'),
  create: (req: CreateInviteRequest) => api.post<CreateInviteResponse>('/api/auth/invites', req),
  revoke: (id: string) => api.del(`/api/auth/invites/${id}`),
};
