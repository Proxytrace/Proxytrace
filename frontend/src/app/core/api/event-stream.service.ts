import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { TraceCreatedEvent, TestRunEvent } from './models';

@Injectable({ providedIn: 'root' })
export class EventStreamService {
  traceStream(): Observable<TraceCreatedEvent> {
    return new Observable(observer => {
      const es = new EventSource('/api/agent-calls/stream');
      es.addEventListener('trace-created', (e: MessageEvent) => {
        observer.next(JSON.parse(e.data) as TraceCreatedEvent);
      });
      es.onerror = () => observer.error(new Error('Trace SSE connection error'));
      return () => es.close();
    });
  }

  testRunStream(runId: string): Observable<TestRunEvent> {
    return new Observable(observer => {
      const es = new EventSource(`/api/test-runs/${runId}/stream`);
      es.addEventListener('test-result-arrived', (e: MessageEvent) => {
        observer.next({ type: 'test-result-arrived', ...JSON.parse(e.data) } as TestRunEvent);
      });
      es.addEventListener('run-complete', (e: MessageEvent) => {
        observer.next({ type: 'run-complete', ...JSON.parse(e.data) } as TestRunEvent);
        observer.complete();
        es.close();
      });
      es.onerror = () => observer.error(new Error('Test run SSE connection error'));
      return () => es.close();
    });
  }
}
