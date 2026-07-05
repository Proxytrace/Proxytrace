# Audit Logging and Notifications as Product Features

Audit trails and user notifications are usually bolted on late — an `INSERT` here, an email call
there — and the result is audit rows that vanish when their subject is deleted, request latency
paying for log persistence, and notification code rewritten for every new delivery medium. This
guide treats both as first-class product subsystems: a capture pipeline decoupled from request
handling for audit, and a channel abstraction with per-user preferences for notifications.

## Principles

- **Audit records semantic actions, not diagnostics.** "API key minted", "project deleted",
  "sign-in failed" — deliberate actions with an actor and a target — belong in the audit log.
  Errors and warnings belong in a separate error/diagnostic log with different retention and
  different loss tolerance. Mixing them makes both useless.
- **Call sites state *what happened*; the pipeline supplies *who and when*.** An emit site passes
  action, target, and scope. Actor resolution (user, API key, system), timestamping, and
  persistence are enriched centrally. This keeps emission one line and attribution consistent.
- **Audit after success, never before.** Emit only once the mutation has actually persisted; a
  failed or no-op action (deleting something already gone) records nothing — except the
  *deliberate* failure events (failed sign-in, failed second factor, denied access), which exist
  precisely to make abuse visible.
- **Audit data must outlive its subjects.** Snapshot names/emails and store plain nullable ids —
  no foreign keys. The "project deleted" row must survive the project.
- **Notification production is separate from delivery.** Producers call one `Notify` entry point;
  a set of pluggable channels (in-app, email, webhook, chat) each decide independently how — and
  whether — to deliver. Cross-cutting concerns (deduplication) live in the dispatcher, not in any
  channel.
- **Recipients control their volume; operators control the floor.** Per-user preferences (enabled,
  minimum severity) filter noisy channels, and an operator-wide severity floor bounds total volume
  regardless of individual settings.

## Patterns

### Audit emission through the standard logging facade

**Problem:** A bespoke `IAuditService` injected everywhere adds a dependency to every controller
and service, and ad-hoc string logging loses structure.

**Solution:** Emit audit events through the logging abstraction the codebase already uses, with a
marker category type and an extension method that packs a **strongly-typed state object**:

```
audit.LogAudit(
    AuditAction.ApiKeyMinted,      // enum; doubles as the persisted event id
    targetType: "ApiKey",
    targetId: saved.Id,
    targetLabel: saved.Name,       // human-readable snapshot
    scopeId: project.Id,           // null => instance-wide/global action
    details: json);                // optional action-specific context
```

The action enum is append-only — values are persisted, so never renumber. The strongly-typed state
(rather than a message-template string) keeps the required fields compile-time-checked while
staying "just a logger" at the call site.

**Rationale:** Zero new dependencies at emit sites, structure enforced by the type system, and the
logging framework's provider model becomes the capture seam for free.

### Asynchronous capture pipeline with synchronous enrichment

**Problem:** Persisting an audit row inline adds a DB write to every audited request (latency,
failure coupling); but deferring everything to a background worker loses the request context the
actor lives in.

**Solution:** A dedicated logger provider captures only the audit category (a level filter pinned
in code so configuration can never silence auditing). Its `Log` method does two things
**synchronously, before returning**: resolve the actor from the current request context and stamp
the event time. It then enqueues the enriched capture onto an **unbounded** in-process channel; a
background writer drains the channel and persists each entry using the *captured* time, not the
drain time. On graceful shutdown the writer makes a best-effort drain of the backlog — document
honestly that this is best-effort, not a durability guarantee (an entry enqueued after the final
drain pass can be lost).

**Rationale:** Requests never wait on audit persistence, yet attribution is exact because the
context-dependent parts happen while the context still exists. Unbounded (vs. the drop-oldest
bounded channel appropriate for a high-volume error log) is right here because audit events are
low-frequency and each one matters.

### Actor abstraction behind an accessor seam

**Problem:** The capture component is a singleton; the "current user" is request-scoped. Injecting
one into the other either crashes or captures the wrong actor.

**Solution:** An `IAuditActorAccessor` seam, implemented in the web layer over the ambient request
context, resolving with **no DB hit**: a user id stashed at authentication time, an API-key
identity detected by its auth scheme, or — with no request context at all (schedulers, background
pipelines, provisioning) — a designated **System** actor. Non-HTTP hosts simply don't register the
accessor; the pipeline resolves it optionally and falls back to System.

**Rationale:** The pipeline stays host-agnostic and every event gets exactly one of three actor
kinds. Background work being attributed to "System" is a feature — it distinguishes automation
from humans in review.

### Audit the denials, not just the deeds

**Problem:** An audit log of only successful actions cannot show brute-forcing, credential
stuffing, or privilege probing — the events security review most wants.

**Solution:** Deliberately record failure-outcome events: failed sign-in and failed second factor
(target = the attempted identity, even if no such account exists — record the attempt without
revealing existence), and denied access via a middleware that captures state-changing requests
rejected with 403, attributed to the authenticated caller. Scope it consciously: skip 401 (no
actor, overlaps failed-login) and skip access checks that intentionally masquerade as 404 (they
are indistinguishable from genuine not-founds at the response layer). Place the middleware so it
still runs when authorization short-circuits.

**Rationale:** Abuse is a pattern of failures. Explicitly designing which denials are captured —
and which are excluded, with reasons — prevents both blind spots and misleading noise.

### FK-free immutable storage, scoped read API, age-based retention

**Problem:** Audit rows with foreign keys get cascade-deleted with their subjects (destroying the
record of the deletion itself); an unscoped read API leaks cross-tenant activity; count-capped
retention silently discards compliance data.

**Solution:** Store denormalized, immutable rows: nullable plain-id columns for actor, key, scope,
and target, plus snapshot strings for labels/emails; index on time, action, and scope. The read
API scopes results: admins see everything including global (null-scope) rows; members see only
their scopes' entries and never global rows; out-of-scope lookups return 404, not 403. Filters:
action, actor infix, scope, target type/id, time range, pagination (newest first). Retention is
**age-based only** (e.g. 365 days, configurable) — no count cap, because the log is meant to be
lossless within the window.

**Rationale:** Immutability plus no-FK is what makes the log evidentiary; scoping makes it safe to
expose in-product; age-based retention aligns with how compliance requirements are actually
phrased.

### Notification channel abstraction with a deduplicating dispatcher

**Problem:** Producers that call email/websocket/DB code directly must change for every new
delivery medium, and per-channel duplicate checks drift out of sync.

**Solution:** One tiny interface and a dispatcher that owns the cross-cutting logic:

```
interface INotificationChannel {
    string Name { get; }
    Task DeliverAsync(NotificationRequest request, CancellationToken ct);
}
```

All implementations are registered in DI; the dispatcher receives them as a collection. Its single
`NotifyAsync`: (1) **deduplicates** — if the request targets an entity that already has an active
notification, drop it before any channel runs (dedup lives here, above all channels, so every
channel is guarded by the same check); (2) **fans out** — call each channel, catching and logging
per-channel failures so one broken channel never blocks the others, but rethrowing cancellation.
Adding a channel (webhook, chat) is one new registration; no producer or dispatcher change.

**Rationale:** Open for extension, closed for producer churn; failure isolation means email being
down doesn't hide the in-app alert; centralized dedup can't be forgotten by channel N+1.

### In-app channel = persist + push; email channel = resolve, filter, isolate

**Problem:** In-app notifications that only push are lost on refresh; email channels without
layered filtering either spam everyone or require every producer to know recipient rules.

**Solution:** The in-app channel persists a notification entity (so it survives reload and has a
read/dismissed lifecycle) and then publishes a created-event to the real-time push system for open
sessions. The email channel runs a filter cascade: operator settings exist and are enabled →
notification severity meets the **operator-wide floor** → resolve candidates (scope members for
scoped notifications, all users for global) → keep those with email delivery enabled, a personal
minimum severity the notification meets, and an address → send one message per recipient, logging
and skipping individual failures. Deep links back into the app are built from a configured base
URL plus the notification's target kind/id.

**Rationale:** Persist-then-push makes in-app notifications a reliable inbox rather than a toast.
The two-level severity model (operator floor AND per-user threshold) means a default install stays
quiet while individuals opt into more — and no producer ever thinks about recipients.

### Settings and secrets handled as operational data

**Problem:** Delivery configuration (SMTP host, credentials) baked into deployment config requires
restarts to change and tempts plaintext secrets in the DB.

**Solution:** Store delivery settings as a single-row entity behind a small store interface;
encrypt secrets at rest through a reusable `ISecretProtector` seam (protect on save, unprotect on
read) backed by the platform's data-protection facility with a persisted key ring. The sender
reads settings per send, so changes apply immediately without restart.

**Rationale:** Operators configure delivery from the admin UI like any other feature; the
encryption seam is generic, so the second and third secret cost nothing; per-call settings reads
make config live.

## Pitfalls

- **Auditing before the mutation commits** — a failed action gets a success row; emit after
  persistence, and make repeated no-op deletes record nothing.
- **Renumbering or reusing action enum values** — persisted rows silently change meaning.
  Append-only, forever.
- **Foreign keys "for integrity" on audit tables** — the integrity you added is exactly what
  deletes the evidence.
- **Letting log configuration filter the audit category** — one ops-side level tweak silently
  disables compliance capture; pin the filter in code.
- **Global (null-scope) events emitted for scoped actions** — they become admin-only rows the
  affected members can never see. Resolve the owning scope, even when it takes an indirect
  projection.
- **Dedup inside one channel** — the others happily re-deliver; dedup belongs in the dispatcher.
- **One recipient's failure aborting the batch** — send-per-recipient with per-send error
  handling, and channel-level catch in the dispatcher.
- **Claiming the async pipeline is lossless** — it is best-effort across shutdown; say so in the
  docs rather than letting operators assume otherwise.

## Checklist for a new project

- [ ] Separate audit log (semantic actions) from error/diagnostic log; different channels,
      retention, and loss tolerance for each.
- [ ] Append-only action enum; typed emit helper taking action, target type/id/label, scope id,
      optional JSON details.
- [ ] Capture pipeline: dedicated provider on a marker category, level pinned in code,
      synchronous actor+timestamp enrichment, unbounded channel, background writer using captured
      time, best-effort shutdown drain.
- [ ] Actor accessor seam with three actor kinds (user / API key / system); optional resolution
      with System fallback for non-web hosts.
- [ ] Failure events designed explicitly: failed login, failed second factor, 403 denials —
      with documented exclusions (401, masked 404s).
- [ ] Storage: immutable, denormalized, FK-free rows with snapshot labels; indexes on time,
      action, scope.
- [ ] Read API scoped (admin = all + global; member = own scopes, no global; 404 for
      out-of-scope); filters + pagination; age-based retention, no count cap.
- [ ] `INotificationChannel` interface; dispatcher with target-based dedup and per-channel
      failure isolation; channels discovered via DI collection.
- [ ] In-app channel persists then pushes; notification entity has a read/dismiss lifecycle.
- [ ] Email channel filter cascade: operator enabled → operator severity floor → scope-resolved
      candidates → per-user enabled + threshold + address → per-recipient send with isolation.
- [ ] Delivery settings as a single-row store read per send; secrets encrypted at rest via a
      reusable protector seam with a persisted key ring.
- [ ] New-action and new-channel procedures documented (emit seam, scope resolution, UI filter
      labels, operator docs).
