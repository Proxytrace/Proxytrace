import { api, qs, type RequestOptions } from './client';
import type { NotificationDto } from './models';

export const notificationsApi = {
  list: (params?: { projectId?: string; includeRead?: boolean }) =>
    api.get<NotificationDto[]>(`/api/notifications${qs(params ?? {})}`),
  /** Single notification by id — resolves rows the list hides (dismissed, or global for a member). */
  get: (id: string, opts?: RequestOptions) => api.get<NotificationDto>(`/api/notifications/${id}`, opts),
  markRead: (id: string, opts?: RequestOptions) =>
    api.patch<NotificationDto>(`/api/notifications/${id}/read`, undefined, opts),
  dismiss: (id: string) => api.patch<NotificationDto>(`/api/notifications/${id}/dismiss`),
};
