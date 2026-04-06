import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AgentCallDto, AgentCallFilter, PagedResult } from './models';

@Injectable({ providedIn: 'root' })
export class AgentCallsService {
  private readonly http = inject(HttpClient);

  getAll(filter: AgentCallFilter = {}): Observable<PagedResult<AgentCallDto>> {
    let params = new HttpParams();
    if (filter.projectId) params = params.set('projectId', filter.projectId);
    if (filter.agentId) params = params.set('agentId', filter.agentId);
    if (filter.model) params = params.set('model', filter.model);
    if (filter.provider) params = params.set('provider', filter.provider);
    if (filter.from) params = params.set('from', filter.from);
    if (filter.to) params = params.set('to', filter.to);
    if (filter.httpStatus != null) params = params.set('httpStatus', filter.httpStatus);
    if (filter.page != null) params = params.set('page', filter.page);
    if (filter.pageSize != null) params = params.set('pageSize', filter.pageSize);
    return this.http.get<PagedResult<AgentCallDto>>('/api/agent-calls', { params });
  }
}
