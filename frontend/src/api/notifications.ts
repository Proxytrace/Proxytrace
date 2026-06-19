import { api, qs } from './client';
import type { NotificationDto } from './models';

export const notificationsApi = {
  list: (params?: { projectId?: string; includeRead?: boolean }) =>
    api.get<NotificationDto[]>(`/api/notifications${qs(params ?? {})}`),
  markRead: (id: string) => api.patch<NotificationDto>(`/api/notifications/${id}/read`),
  dismiss: (id: string) => api.patch<NotificationDto>(`/api/notifications/${id}/dismiss`),
};
