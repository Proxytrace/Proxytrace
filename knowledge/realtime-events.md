# Real-Time Server Push Design

Polling turns a snappy UI into a tax on the backend and still feels stale; naive server push turns
into a different mess — untyped payload blobs, streams that silently die after the first network
blip, and connection exhaustion that mysteriously blocks unrelated requests. This guide describes a
server-push architecture (SSE or WebSocket) built on a broadcaster abstraction, typed events,
per-resource streams, shared client subscriptions, and self-healing reconnection.

## Principles

- **Push is a notification, not a data transfer.** Events carry identity plus a thin summary — the
  id of what changed, what happened, and whatever tiny slice the UI must update immediately.
  Clients fetch or patch details through the normal query layer. Fat events duplicate the read
  model and drift from it.
- **The event contract has three synchronized parts** — the event *name* on the wire, the payload
  *shape*, and the client's *listener registration*. If any one drifts, updates silently never
  arrive (no error, just staleness). Keep server records, wire names, and client types in lockstep,
  documented in a single event catalog.
- **Producers publish; transport subscribes.** Domain services publish to an in-process broadcaster
  and know nothing about HTTP. The transport endpoint (SSE controller, WS handler) is a thin
  adapter that subscribes a connection to a channel and serializes frames.
- **Every stream is tenant-scoped.** Per-resource streams authorize once before subscribing (and
  return not-found, not forbidden, to avoid leaking existence). Global-broadcaster streams filter
  *every frame* against the caller's accessible scope — which means every event on a global
  broadcaster must carry its owning scope id on the payload.
- **Assume every connection will die.** Reconnection, heartbeats, and post-terminal refetch are
  not edge-case handling; they are the design. A stream without a liveness story leaks server
  resources; a client without a reconnect story goes quietly stale.
- **Long-lived connections are a scarce browser resource.** Under HTTP/1.1 a browser allows ~6
  connections per host, and each open stream spends one permanently. Design for connection sharing
  from day one.

## Patterns

### Broadcaster abstraction

**Problem:** If domain code writes to sockets directly, business logic couples to transport,
becomes untestable, and every new consumer (a second endpoint, a test, a background listener)
requires touching producers.

**Solution:** Per event family, a small in-process pub/sub interface:

```
interface IOrderEventBroadcaster {
    ChannelReader<OrderEvent> Subscribe(CancellationToken ct);   // one channel per subscriber
    void Publish(OrderEvent evt);                                // fan-out to all subscribers
}
```

Producers (the ingest service, the job runner, the review pipeline) inject the interface and call
`Publish` after the state change persists. The transport layer calls `Subscribe` per connection
and drains the reader. Broadcasters are either **global** (one channel for all of an event type,
filtered downstream) or **per-resource** (keyed by resource id, e.g. one job's progress events).

**Rationale:** Producers stay transport-free and trivially testable (assert `Publish` was called
on a fake). Adding a new consumer — or swapping SSE for WebSocket — touches only the adapter.

### Typed event payloads with a shared base

**Problem:** Ad-hoc anonymous/dictionary payloads mean the client guesses at shapes, renames break
silently, and nobody can enumerate what events exist.

**Solution:** One immutable record per event, sharing a base type that carries the common identity
fields (resource id, scope/tenant id). Serialize with a fixed, dedicated serializer profile
(casing, converters) so the wire format never depends on ambient config. Mirror each record as a
client-side type; wrap the wire frame so consumers receive `{ type: <event-name>, ...payload }`.

```
record JobEvent(Guid JobId, Guid GroupId);                       // base identity
record StepStartedEvent(..., Guid StepId) : JobEvent;
record StepResultEvent(..., Guid StepId, double Score) : JobEvent;
record JobCompleteEvent(..., string Status, DateTimeOffset? At) : JobEvent;  // terminal
```

**Rationale:** The record set *is* the catalog. Compilers and typecheckers on both sides catch
drift; new fields are additive and reviewable.

### Per-resource streams with terminal events

**Problem:** A single firehose stream forces every client to receive and discard everything, and
gives finite processes (a job, an import, a run) no natural end — clients poll "is it done yet?"
on top of the stream.

**Solution:** Give bounded processes their own stream endpoint (`/api/jobs/{id}/stream`) that
emits progress events and a designated **terminal event** (`job-complete`). The client closes the
connection on the terminal event, then **invalidates/refetches the relevant queries** to heal any
frames dropped mid-stream. Views driven this way are pure-push — do not layer a polling interval
back on top. Key the subscription lifetime off the *parent* resource's status, not off child
completions: a child's "done" event can arrive before the parent's terminal event, and tearing the
stream down early means the terminal handler never runs and the UI sticks in "running".

**Rationale:** Terminal events give connections a bounded lifetime; the refetch-on-terminal makes
correctness independent of perfect delivery — push provides latency, the query layer provides
truth.

### Small events, client-side cache patching

**Problem:** Streaming full resource representations bloats frames, races the read API, and forces
the server to know every view's data needs.

**Solution:** Events carry ids plus the minimal delta (a status, a score, a per-item cost). The
client hook patches the relevant entry in its query cache (`setQueryData`-style) — no-oping if the
detail hasn't been fetched yet, since an event can arrive before the initial GET resolves. Include
a small denormalized field on an event only when the UI must update *before* a refetch round-trip
could complete (e.g. flipping a status badge on the terminal event), then still invalidate for the
full truth.

**Rationale:** The read model stays the single source of detail; events stay cheap enough that
volume never matters; UIs update instantly where it's felt and heal everywhere else.

### Client subscription hooks with connection multiplexing

**Problem:** If every component opens its own connection, four widgets watching the same feed burn
four of the browser's ~6 per-host HTTP/1.1 slots — leaving none for ordinary fetches, whose
requests then silently never leave the browser (buttons that "do nothing" while a detail page is
open).

**Solution:** All consumption goes through typed hooks (`useJobStream`, `useFeedStream`) built on
one generic subscribe function that keeps **one shared connection per (url, event-set)**,
ref-counted: first subscriber opens, frames fan out to all, last subscriber closes. Raw
`new EventSource(...)`/`new WebSocket(...)` in components is forbidden. Short-lived per-resource
streams with unique URLs may stay per-instance — sharing buys nothing there. Keep a single page's
count of *distinct* long-lived streams comfortably under the browser's connection budget.

**Rationale:** Subscribing from N components becomes free, and the connection budget stops being
something feature authors can accidentally exhaust.

### Client-owned reconnection with fresh credentials

**Problem:** Native `EventSource` cannot send an `Authorization` header, so credentials ride the
URL; native auto-reconnect then replays the same URL — and if the credential was single-use, every
reconnect 401s, silently killing the stream after the first backend restart or laptop sleep.

**Solution:** Authenticate streams with a **short-lived, single-use ticket** minted from a
dedicated endpoint and passed as a query parameter (never the long-lived session token if
avoidable). The client library owns reconnection: on error it closes the source, re-mints a fresh
ticket, and reopens with exponential backoff (e.g. 1s → 30s cap), resetting the backoff on any
delivered frame.

**Rationale:** Tokens stop leaking into proxy/access logs with long validity; reconnection works
identically across auth modes; a dropped stream heals itself instead of requiring a page reload.

### Heartbeats and subscriber caps

**Problem:** A half-open TCP connection never signals disconnect on a quiet stream, so its
server-side subscription (memory, a channel, a slot) leaks forever; and nothing stops one client
from opening unbounded streams.

**Solution:** On the server, wrap the channel drain so that after N seconds of silence (e.g. 20s)
a comment/ping frame is written; the write fails on a dead socket, the handler unwinds, and the
cancellation callback removes the subscription. Cap total live subscribers per broadcaster (e.g.
2000): past the cap, `Subscribe` returns an already-completed reader so the request closes
cleanly. Reject subscriptions whose cancellation token cannot fire — a subscription with no
disconnect path is a guaranteed leak. Set the transport headers that keep frames flowing
(`no-cache`, disable proxy buffering).

**Rationale:** Liveness is probed by writing, which is the only signal TCP reliably gives you;
the cap converts a memory-exhaustion vector into graceful degradation.

## Pitfalls

- **Name drift = silent staleness.** A renamed event on the server with an un-renamed client
  listener produces no error anywhere. Keep the catalog (names + shapes + endpoints) in one
  document and update it with every change.
- **`networkidle`-style waits and health checks hang forever** once the app holds long-lived
  streams — anything (tests, probes) that waits for network quiescence must wait on concrete
  elements/conditions instead.
- **Re-adding polling to a push-driven view** hides dropped-event bugs and doubles load. If a
  push view goes stale, fix delivery or the terminal-refetch, don't paper over it.
- **Global broadcaster without scope on the payload.** The frame filter has nothing to filter on,
  so cross-tenant data leaks. Scope id on the event is mandatory, not optional.
- **Streaming state transitions that were never published.** If the server flips a status without
  emitting an event (e.g. pending → running happens implicitly), the client shows the stale state
  for the resource's whole life; either publish the transition or derive it client-side from the
  first observable child event, idempotently.
- **Token-stream endpoints mixed into the domain-event catalog.** Raw model/LLM token streaming
  for a single request is a different beast (request-scoped, no broadcaster) — keep it out of the
  domain event system.

## Checklist for a new project

- [ ] Broadcaster interface per event family (`Subscribe` → channel reader, `Publish`), registered
      in DI; producers publish after persistence, never write to transport.
- [ ] Typed event records with a shared base carrying resource id + scope id; fixed serializer
      profile; mirrored client types.
- [ ] Event catalog document: endpoint, scope, event names, payload record, consuming view —
      updated in the same change as any event change.
- [ ] Per-resource streams for bounded processes with a designated terminal event; client closes
      and invalidates queries on terminal.
- [ ] Authorization: per-resource streams checked before subscribe (404 on no access); global
      streams filtered per frame by scope id.
- [ ] One generic client subscribe function with per-(url, events) connection sharing and
      ref-counting; typed hooks on top; direct EventSource/WebSocket construction banned.
- [ ] Client-owned reconnect with freshly-minted single-use tickets and capped exponential backoff.
- [ ] Server heartbeat on idle, subscriber cap per broadcaster, rejection of non-cancellable
      subscriptions, proxy-buffering disabled.
- [ ] Events kept small: ids + minimal delta; details via the query layer; cache patching no-ops
      before the initial fetch resolves.
