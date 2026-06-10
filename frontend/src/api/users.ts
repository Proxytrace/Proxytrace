import { api, qs } from './client';
import type { PagedResult, UserDto, UserProjectDto, UserRole } from './models';

export const usersApi = {
  list: (params?: { page?: number; pageSize?: number }) =>
    api.get<PagedResult<UserDto>>(`/api/users${qs(params ?? {})}`),
  get: (id: string) => api.get<UserDto>(`/api/users/${id}`),
  updateRole: (id: string, role: UserRole) => api.put<UserDto>(`/api/users/${id}/role`, { role }),
  delete: (id: string) => api.del(`/api/users/${id}`),
  listProjects: (id: string) => api.get<UserProjectDto[]>(`/api/users/${id}/projects`),
};
