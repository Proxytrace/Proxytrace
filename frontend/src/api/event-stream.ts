import { useEffect, useMemo, useRef } from 'react';
import { getAccessToken } from '../auth/token';
import type { GroupRunCompleteEvent, ProposalCreatedEvent, TestRunEvent, TraceCreatedEvent } from './models';

function withAuth(url: string): string {
  const token = getAccessToken();
  if (!token) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}access_token=${encodeURIComponent(token)}`;
}

export function useEventStream<T>(
  url: string | null,
  events: string[],
  onEvent: (event: T) => void,
  onComplete?: () => void,
  completeEvent?: string,
) {
  const onEventRef = useRef(onEvent);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  const eventsKey = useMemo(() => events.join(','), [events]);
  const eventNames = useMemo(() => eventsKey.split(','), [eventsKey]);

  useEffect(() => {
    if (!url) return;
    const es = new EventSource(withAuth(url));

    for (const name of eventNames) {
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
  }, [url, eventNames, completeEvent]);
}

export function useTraceStream(onTrace: (e: TraceCreatedEvent) => void) {
  useEventStream<TraceCreatedEvent>(
    '/api/agent-calls/stream',
    ['trace-created'],
    onTrace,
  );
}

export function useProposalStream(agentId: string | null, onProposal: (e: ProposalCreatedEvent) => void) {
  useEventStream<ProposalCreatedEvent>(
    agentId ? `/api/agents/${agentId}/proposals/stream` : null,
    ['proposal-created'],
    onProposal,
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
