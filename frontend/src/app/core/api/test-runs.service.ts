import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PagedResult, TestCaseFixtureDto, TestRunDto } from './models';

@Injectable({ providedIn: 'root' })
export class TestRunsService {
  private readonly http = inject(HttpClient);

  getAll(agentId?: string | null, page = 1, pageSize = 100): Observable<PagedResult<TestRunDto>> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (agentId) params = params.set('agentId', agentId);
    return this.http.get<PagedResult<TestRunDto>>('/api/test-runs', { params });
  }

  get(id: string): Observable<TestRunDto> {
    return this.http.get<TestRunDto>(`/api/test-runs/${id}`);
  }

  create(request: { testSuiteId: string; modelEndpointId: string }): Observable<TestRunDto> {
    return this.http.post<TestRunDto>('/api/test-runs', request);
  }

  cancel(id: string): Observable<void> {
    return this.http.post<void>(`/api/test-runs/${id}/cancel`, null);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`/api/test-runs/${id}`);
  }

  getFixture(runId: string, caseId: string): Observable<TestCaseFixtureDto> {
    return this.http.get<TestCaseFixtureDto>(`/api/test-runs/${runId}/cases/${caseId}/fixture`);
  }
}
