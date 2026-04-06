import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SummaryDto } from './models';

@Injectable({ providedIn: 'root' })
export class StatisticsService {
  private readonly http = inject(HttpClient);

  getSummary(): Observable<SummaryDto> {
    return this.http.get<SummaryDto>('/api/statistics/summary');
  }
}
