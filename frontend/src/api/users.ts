import { api, qs } from './client';
import type { NotificationSeverity, PagedResult, UserDto, UserProjectDto, UserRole } from './models';

export const usersApi = {
  list: (params?: { page?: number; pageSize?: number }) =>
    api.get<PagedResult<UserDto>>(`/api/users${qs(params ?? {})}`),
  get: (id: string) => api.get<UserDto>(`/api/users/${id}`),
  updateRole: (id: string, role: UserRole) => api.put<UserDto>(`/api/users/${id}/role`, { role }),
  /** Self-service: change the current user's own UI language (BCP-47 code). */
  updateMyLanguage: (language: string) => api.patch<void>(`/api/users/me`, { language }),
  /** Self-service: change the current user's own email-notification preferences. */
  updateMyEmailNotifications: (enabled: boolean, minSeverity: NotificationSeverity) =>
    api.patch<void>(`/api/users/me/email-notifications`, { enabled, minSeverity }),
  delete: (id: string) => api.del(`/api/users/${id}`),
  listProjects: (id: string) => api.get<UserProjectDto[]>(`/api/users/${id}/projects`),
};
