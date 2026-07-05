import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The stream credential (a single-use ticket) is baked into the EventSource URL. The browser's
// native reconnect would replay the *consumed* ticket and get a 401, permanently killing the stream
// after the first drop. subscribeShared must instead reconnect with a freshly-minted ticket.

vi.mock('../auth/token', () => ({ getAccessToken: () => 'jwt' }));

import { subscribeShared } from './event-stream';

// Minimal EventSource stand-in — jsdom/node don't provide one. Records the URL each instance was
// opened with so the test can assert the ticket differs across reconnects.
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  addEventListener() {}
  close() { this.closed = true; }
}

function ticketFor(url: string): string {
  return new URL(url, 'http://x').searchParams.get('stream_ticket') ?? '';
}

describe('subscribeShared reconnection', () => {
  let ticketSeq = 0;

  beforeEach(() => {
    vi.useFakeTimers();
    ticketSeq = 0;
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource as unknown as typeof EventSource);
    // Each stream-ticket request mints a distinct single-use ticket.
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ token: `ticket-${ticketSeq++}` }),
    }) as unknown as Response));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reopens with a fresh ticket after the connection errors', async () => {
    const unsubscribe = subscribeShared('/api/agent-calls/stream', ['trace-created'], () => {});

    // withAuth is async (it fetches a ticket) — let it resolve and open the first EventSource.
    await vi.runAllTimersAsync();
    expect(FakeEventSource.instances).toHaveLength(1);
    const first = FakeEventSource.instances[0];
    expect(ticketFor(first.url)).toBe('ticket-0');

    // Simulate a dropped connection.
    first.onerror?.();
    expect(first.closed).toBe(true);

    // The backoff timer fires and reopens with a NEW ticket (not the consumed 'ticket-0').
    await vi.runAllTimersAsync();
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(ticketFor(FakeEventSource.instances[1].url)).toBe('ticket-1');

    unsubscribe();
  });

  it('stops reconnecting once the last subscriber unsubscribes', async () => {
    const unsubscribe = subscribeShared('/api/agent-calls/stream', ['trace-created'], () => {});
    await vi.runAllTimersAsync();
    const first = FakeEventSource.instances[0];

    unsubscribe();
    expect(first.closed).toBe(true);

    // An error after teardown must not schedule a reconnect.
    first.onerror?.();
    await vi.runAllTimersAsync();
    expect(FakeEventSource.instances).toHaveLength(1);
  });
});
