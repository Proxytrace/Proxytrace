import { api, qs } from './client';
import type { PagedResult, UserDto } from './models';

export const usersApi = {
  list: (params?: { page?: number; pageSize?: number }) =>
    api.get<PagedResult<UserDto>>(`/api/users${qs(params ?? {})}`),
  get: (id: string) => api.get<UserDto>(`/api/users/${id}`),
};
