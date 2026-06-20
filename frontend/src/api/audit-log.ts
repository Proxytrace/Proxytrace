import { api, qs, type RequestOptions } from './client';
import type { AuditLogEntryDto, AuditLogFilter, PagedResult } from './models';

export const auditLogApi = {
  list: (filter: AuditLogFilter) =>
    api.get<PagedResult<AuditLogEntryDto>>(`/api/audit-log${qs(filter as unknown as Record<string, unknown>)}`),
  get: (id: string, opts?: RequestOptions) => api.get<AuditLogEntryDto>(`/api/audit-log/${id}`, opts),
};
