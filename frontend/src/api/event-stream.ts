import { useEffect, useMemo, useRef } from 'react';
import { getAccessToken } from '../auth/token';
import type { GroupRunCompleteEvent, ProposalCreatedEvent, TestRunEvent, TraceCreatedEvent } from './models';

// EventSource can't set Authorization headers, so the token must ride in the query
// string. Prefer a short-lived, single-use stream ticket over the long-lived session
// JWT; fall back to the JWT (silently) until the backend implements the ticket endpoint.
async function resolveStreamToken(jwt: string): Promise<string> {
  try {
    const res = await fetch('/api/auth/stream-ticket', {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (res.ok) {
      const data = (await res.json()) as { token?: string };
      if (data.token) return data.token;
    }
  } catch {
    // ignore — fall back to the JWT below
  }
  return jwt;
}

async function withAuth(url: string): Promise<string> {
  const jwt = getAccessToken();
  if (!jwt) return url;
  const token = await resolveStreamToken(jwt);
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
    let es: EventSource | null = null;
    let cancelled = false;

    void withAuth(url).then((authedUrl) => {
      if (cancelled) return;
      es = new EventSource(authedUrl);

      for (const name of eventNames) {
        es.addEventListener(name, (e: MessageEvent) => {
          onEventRef.current({ type: name, ...JSON.parse(e.data) } as T);
        });
      }

      if (completeEvent) {
        es.addEventListener(completeEvent, (e: MessageEvent) => {
          onEventRef.current({ type: completeEvent, ...JSON.parse(e.data) } as T);
          onCompleteRef.current?.();
          es?.close();
        });
      }
    });

    return () => {
      cancelled = true;
      es?.close();
    };
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
