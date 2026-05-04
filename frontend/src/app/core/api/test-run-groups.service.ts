import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PagedResult, TestRunGroupDto } from './models';

@Injectable({ providedIn: 'root' })
export class TestRunGroupsService {
  private readonly http = inject(HttpClient);

  getAll(agentId?: string | null, page = 1, pageSize = 100): Observable<PagedResult<TestRunGroupDto>> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (agentId) params = params.set('agentId', agentId);
    return this.http.get<PagedResult<TestRunGroupDto>>('/api/test-run-groups', { params });
  }

  get(id: string): Observable<TestRunGroupDto> {
    return this.http.get<TestRunGroupDto>(`/api/test-run-groups/${id}`);
  }

  create(request: { testSuiteId: string; modelEndpointIds: string[] }): Observable<TestRunGroupDto> {
    return this.http.post<TestRunGroupDto>('/api/test-run-groups', request);
  }

  cancel(id: string): Observable<TestRunGroupDto> {
    return this.http.post<TestRunGroupDto>(`/api/test-run-groups/${id}/cancel`, null);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`/api/test-run-groups/${id}`);
  }
}
