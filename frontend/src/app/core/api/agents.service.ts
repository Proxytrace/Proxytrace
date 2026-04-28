import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AgentDto, PagedResult } from './models';

@Injectable({ providedIn: 'root' })
export class AgentsService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<PagedResult<AgentDto>> {
    const params = new HttpParams().set('pageSize', '200');
    return this.http.get<PagedResult<AgentDto>>('/api/agents', { params });
  }
}
