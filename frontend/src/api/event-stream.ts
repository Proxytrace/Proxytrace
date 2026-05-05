import { useEffect, useRef } from 'react';
import type { GroupRunCompleteEvent, TestRunEvent, TraceCreatedEvent } from './models';

export function useEventStream<T>(
  url: string | null,
  events: string[],
  onEvent: (event: T) => void,
  onComplete?: () => void,
  completeEvent?: string,
) {
  const onEventRef = useRef(onEvent);
  const onCompleteRef = useRef(onComplete);
  onEventRef.current = onEvent;
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!url) return;
    const es = new EventSource(url);

    for (const name of events) {
      es.addEventListener(name, (e: MessageEvent) => {
        onEventRef.current({ type: name, ...JSON.parse(e.data) } as T);
      });
    }

    if (completeEvent) {
      es.addEventListener(completeEvent, (e: MessageEvent) => {
        onEventRef.current({ type: completeEvent, ...JSON.parse(e.data) } as T);
        onCompleteRef.current?.();
        es.close();
      });
    }

    return () => es.close();
  }, [url, events.join(','), completeEvent]);
}

export function useTraceStream(onTrace: (e: TraceCreatedEvent) => void) {
  useEventStream<TraceCreatedEvent>(
    '/api/agent-calls/stream',
    ['trace-created'],
    onTrace,
  );
}

const RUN_EVENTS = ['test-case-started', 'inference-done', 'evaluation-arrived', 'test-result-arrived', 'run-complete'];

export function useTestRunStream(runId: string | null, onEvent: (e: TestRunEvent) => void, onDone?: () => void) {
  useEventStream<TestRunEvent>(
    runId ? `/api/test-runs/${runId}/stream` : null,
    RUN_EVENTS.slice(0, 4),
    onEvent,
    onDone,
    'run-complete',
  );
}

const GROUP_EVENTS = ['test-case-started', 'inference-done', 'evaluation-arrived', 'test-result-arrived', 'run-complete'];

export function useTestRunGroupStream(
  groupId: string | null,
  onEvent: (e: TestRunEvent) => void,
  onDone?: () => void,
) {
  useEventStream<GroupRunCompleteEvent | TestRunEvent>(
    groupId ? `/api/test-run-groups/${groupId}/stream` : null,
    GROUP_EVENTS,
    onEvent as (e: GroupRunCompleteEvent | TestRunEvent) => void,
    onDone,
    'group-run-complete',
  );
}
