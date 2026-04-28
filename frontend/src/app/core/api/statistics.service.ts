import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SummaryDto, ModelBreakdownDto, LatencyStatDto } from './models';

@Injectable({ providedIn: 'root' })
export class StatisticsService {
  private readonly http = inject(HttpClient);

  getSummary(from?: string): Observable<SummaryDto> {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    return this.http.get<SummaryDto>('/api/statistics/summary', { params });
  }

  getLatency(filter: { from?: string; agentId?: string } = {}): Observable<LatencyStatDto[]> {
    let params = new HttpParams();
    if (filter.from) params = params.set('from', filter.from);
    if (filter.agentId) params = params.set('agentId', filter.agentId);
    return this.http.get<LatencyStatDto[]>('/api/statistics/latency', { params });
  }

  getModelBreakdown(filter: { from?: string; agentId?: string } = {}): Observable<ModelBreakdownDto[]> {
    let params = new HttpParams();
    if (filter.from) params = params.set('from', filter.from);
    if (filter.agentId) params = params.set('agentId', filter.agentId);
    return this.http.get<ModelBreakdownDto[]>('/api/statistics/model-breakdown', { params });
  }
}
