import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PagedResult, TestSuiteDto } from './models';

@Injectable({ providedIn: 'root' })
export class TestSuitesService {
  private readonly http = inject(HttpClient);

  getAll(agentId?: string | null): Observable<PagedResult<TestSuiteDto>> {
    let params = new HttpParams().set('pageSize', '200');
    if (agentId) params = params.set('agentId', agentId);
    return this.http.get<PagedResult<TestSuiteDto>>('/api/test-suites', { params });
  }

  addTestCase(suiteId: string, fromAgentCallId: string): Observable<TestSuiteDto> {
    return this.http.post<TestSuiteDto>(`/api/test-suites/${suiteId}/test-cases`, { fromAgentCallId });
  }

  createFromTrace(agentId: string, fromAgentCallId: string): Observable<TestSuiteDto> {
    return this.http.post<TestSuiteDto>('/api/test-suites', {
      agentId,
      evaluatorKind: 0,
      testCases: [{ fromAgentCallId }],
    });
  }
}
