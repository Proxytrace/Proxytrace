import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreateEvaluatorPayload, EvaluatorDetailDto } from './models';

@Injectable({ providedIn: 'root' })
export class EvaluatorsService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<EvaluatorDetailDto[]> {
    return this.http.get<EvaluatorDetailDto[]>('/api/evaluators');
  }

  get(id: string): Observable<EvaluatorDetailDto> {
    return this.http.get<EvaluatorDetailDto>(`/api/evaluators/${id}`);
  }

  create(payload: CreateEvaluatorPayload): Observable<EvaluatorDetailDto> {
    return this.http.post<EvaluatorDetailDto>('/api/evaluators', payload);
  }

  update(id: string, payload: Partial<CreateEvaluatorPayload>): Observable<EvaluatorDetailDto> {
    return this.http.put<EvaluatorDetailDto>(`/api/evaluators/${id}`, payload);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`/api/evaluators/${id}`);
  }
}
