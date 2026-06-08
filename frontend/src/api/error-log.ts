import { api, qs } from './client';
import type { ApplicationErrorDto, ApplicationErrorFilter, PagedResult } from './models';

export const errorLogApi = {
  list: (filter: ApplicationErrorFilter) =>
    api.get<PagedResult<ApplicationErrorDto>>(`/api/error-log${qs(filter as unknown as Record<string, unknown>)}`),
  get: (id: string) => api.get<ApplicationErrorDto>(`/api/error-log/${id}`),
};
