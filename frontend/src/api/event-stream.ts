import { useEffect, useMemo, useRef } from 'react';
import { getAccessToken } from '../auth/token';
import type { AnomalyFlaggedEvent, GroupRunCompleteEvent, NotificationEvent, ProposalEvent, TestRunEvent, TheoryStatusChangedEvent, TraceCreatedEvent } from './models';

// EventSource can't set Authorization headers, so the credential must ride in the query
// string. Prefer a short-lived, single-use stream ticket (passed as `stream_ticket`, which
// the backend redeems once) over the long-lived session JWT; fall back to the JWT in
// `access_token` only when the ticket endpoint is unreachable.
type StreamCredential = { param: 'stream_ticket' | 'access_token'; value: string };

async function resolveStreamCredential(jwt: string): Promise<StreamCredential> {
  try {
    const res = await fetch('/api/auth/stream-ticket', {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (res.ok) {
      const data = (await res.json()) as { token?: string };
      if (data.token) return { param: 'stream_ticket', value: data.token };
    }
  } catch {
    // ignore - fall back to the JWT below
  }
  return { param: 'access_token', value: jwt };
}

async function withAuth(url: string): Promise<string> {
  const jwt = getAccessToken();
  if (!jwt) return url;
  const { param, value } = await resolveStreamCredential(jwt);
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}${param}=${encodeURIComponent(value)}`;
}

// Shared (multiplexed) connections.
// EventSource connections are long-lived and count against the browser's per-host HTTP/1.1
// connection cap (6 in Chromium). Several hooks subscribe to the SAME endpoint - above all
// `/api/agent-calls/stream`, which the agent-detail page alone mounts four times (stats +
// recent-traces + outliers + distributions). One EventSource per subscriber would burn four of
// the six slots on identical streams and starve ordinary fetches: a delete/save fired while the
// detail is open never gets a socket, so the request never leaves the browser (no response, no
// server-side effect). So we keep ONE EventSource per (url, events) and fan each frame out to
// every subscriber, ref-counted: the first subscriber opens it, the last closes it.
interface SharedStream {
  refCount: number;
  handlers: Set<(event: unknown) => void>;
  close: () => void;
}

const sharedStreams = new Map<string, SharedStream>();

// Exported for tests (reconnection behaviour); internal to this module otherwise.
export function subscribeShared(
  url: string,
  eventNames: string[],
  handler: (event: unknown) => void,
): () => void {
  const key = `${url} ${eventNames.join(',')}`;
  let shared = sharedStreams.get(key);
  if (!shared) {
    const handlers = new Set<(event: unknown) => void>();
    let es: EventSource | null = null;
    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    // The stream credential (a single-use ticket) is baked into the URL, so the browser's native
    // EventSource reconnect would replay the *consumed* ticket and get a 401 — permanently killing
    // the stream after the first drop (a dev backend restart, a proxy blip, a laptop sleep). The
    // list then goes stale until a full page reload mints a fresh ticket. So we take reconnection
    // over: on any error we close this source (stopping the doomed native retry) and reopen with a
    // freshly-minted ticket after an exponential backoff. Reopening re-runs `withAuth`, so this
    // works in every auth mode — including OIDC, where there is no session-cookie fallback.
    const open = () => {
      void withAuth(url).then((authedUrl) => {
        if (closed) return;
        const source = new EventSource(authedUrl);
        es = source;
        source.onopen = () => { attempt = 0; };
        for (const name of eventNames) {
          source.addEventListener(name, (e: MessageEvent) => {
            attempt = 0; // a delivered frame proves the connection is healthy
            const event = { type: name, ...JSON.parse(e.data) };
            handlers.forEach((h) => h(event));
          });
        }
        source.onerror = () => {
          source.close();
          // Ignore errors from a source we've already replaced or torn down.
          if (closed || es !== source) return;
          es = null;
          const delay = Math.min(1000 * 2 ** attempt, 30000);
          attempt += 1;
          reconnectTimer = setTimeout(open, delay);
        };
      });
    };
    open();
    shared = {
      refCount: 0,
      handlers,
      close: () => {
        closed = true;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        es?.close();
      },
    };
    sharedStreams.set(key, shared);
  }
  const conn = shared;
  conn.handlers.add(handler);
  conn.refCount += 1;
  return () => {
    conn.handlers.delete(handler);
    conn.refCount -= 1;
    if (conn.refCount === 0) {
      conn.close();
      sharedStreams.delete(key);
    }
  };
}

export function useEventStream<T>(
  url: string | null,
  events: string[],
  onEvent: (event: T) => void,
  onComplete?: (event: T) => void,
  completeEvent?: string,
) {
  const onEventRef = useRef(onEvent);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  const eventsKey = useMemo(() => events.join(','), [events]);

  useEffect(() => {
    if (!url) return;
    const eventNames = eventsKey.split(',');

    // Terminal streams (a single test-run / group view) self-close on `completeEvent` and each has
    // a unique URL + its own close-on-complete lifecycle, so multiplexing buys nothing - keep them
    // per-instance. Everything else (trace / proposal / theory / notification) shares one connection
    // per (url, events) across all subscribers via `subscribeShared`.
    if (completeEvent) {
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
        es.addEventListener(completeEvent, (e: MessageEvent) => {
          const evt = { type: completeEvent, ...JSON.parse(e.data) } as T;
          onEventRef.current(evt);
          // Hand the terminal payload to onComplete so the run view can flip the group's own status
          // from the event (it carries the final status) instead of waiting on the invalidate refetch.
          onCompleteRef.current?.(evt);
          es?.close();
        });
      });
      return () => {
        cancelled = true;
        es?.close();
      };
    }

    return subscribeShared(url, eventNames, (event) => onEventRef.current(event as T));
  }, [url, eventsKey, completeEvent]);
}

export function useTraceStream(onTrace: (e: TraceCreatedEvent) => void) {
  useEventStream<TraceCreatedEvent>(
    '/api/agent-calls/stream',
    ['trace-created'],
    onTrace,
  );
}

/**
 * Custom-detector anomaly stream: fires `anomaly-flagged` when a detector flags a call. Multiplexed
 * per (url, events) like the other non-terminal streams. `useEventStream` already retries a dropped
 * connection, and a stream that never connects simply yields no events — so subscribing is safe even
 * before the backend endpoint ships; it never blocks or breaks the page.
 */
export function useAnomalyStream(projectId: string | undefined, onAnomaly: (e: AnomalyFlaggedEvent) => void) {
  useEventStream<AnomalyFlaggedEvent>(
    `/api/anomalies/stream${projectId ? `?projectId=${projectId}` : ''}`,
    ['anomaly-flagged'],
    onAnomaly,
  );
}

export function useNotificationStream(
  projectId: string | undefined,
  onNotification: (e: NotificationEvent) => void,
) {
  useEventStream<NotificationEvent>(
    `/api/notifications/stream${projectId ? `?projectId=${projectId}` : ''}`,
    ['notification-created', 'notification-status-changed'],
    onNotification,
  );
}

export function useProposalStream(agentId: string | null, onProposal: (e: ProposalEvent) => void) {
  useEventStream<ProposalEvent>(
    agentId ? `/api/agents/${agentId}/proposals/stream` : null,
    ['proposal-created', 'proposal-status-changed'],
    onProposal,
  );
}

export function useTheoryStream(agentId: string | null, onTheory: (e: TheoryStatusChangedEvent) => void) {
  useEventStream<TheoryStatusChangedEvent>(
    agentId ? `/api/agents/${agentId}/theories/stream` : null,
    ['theory-changed'],
    onTheory,
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
  onDone?: (e: GroupRunCompleteEvent | TestRunEvent) => void,
) {
  useEventStream<GroupRunCompleteEvent | TestRunEvent>(
    groupId ? `/api/test-run-groups/${groupId}/stream` : null,
    GROUP_EVENTS,
    onEvent as (e: GroupRunCompleteEvent | TestRunEvent) => void,
    onDone,
    'group-run-complete',
  );
}
