import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PagedResult, TestRunDto, TestSuiteDto } from './models';

export interface CreateTestSuitePayload {
  name: string;
  agentId: string;
  evaluatorIds: string[];
  testCases: { fromAgentCallId: string }[];
}

@Injectable({ providedIn: 'root' })
export class TestSuitesService {
  private readonly http = inject(HttpClient);

  getAll(agentId?: string | null): Observable<PagedResult<TestSuiteDto>> {
    let params = new HttpParams().set('pageSize', '200');
    if (agentId) params = params.set('agentId', agentId);
    return this.http.get<PagedResult<TestSuiteDto>>('/api/test-suites', { params });
  }

  create(payload: CreateTestSuitePayload): Observable<TestSuiteDto> {
    return this.http.post<TestSuiteDto>('/api/test-suites', payload);
  }

  delete(suiteId: string): Observable<void> {
    return this.http.delete<void>(`/api/test-suites/${suiteId}`);
  }

  run(suiteId: string): Observable<TestRunDto> {
    return this.http.post<TestRunDto>(`/api/test-suites/${suiteId}/run`, {});
  }

  addTestCase(suiteId: string, fromAgentCallId: string): Observable<TestSuiteDto> {
    return this.http.post<TestSuiteDto>(`/api/test-suites/${suiteId}/test-cases`, { fromAgentCallId });
  }

  createFromTrace(agentId: string, fromAgentCallId: string): Observable<TestSuiteDto> {
    return this.http.post<TestSuiteDto>('/api/test-suites', {
      name: 'Suite from trace',
      agentId,
      evaluatorIds: [],
      testCases: [{ fromAgentCallId }],
    });
  }
}
