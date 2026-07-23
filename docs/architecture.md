# Architecture

Strict layered dependency flow — each layer may only depend on layers below it:

```
Proxytrace.Api  →  Proxytrace.Application  →  Proxytrace.Domain  →  Proxytrace.Common
            →  Proxytrace.Infrastructure  →  Proxytrace.Domain + Proxytrace.Serialization  →  Proxytrace.Common
            →  Proxytrace.Storage  →  Proxytrace.Domain
```

> **`Proxytrace.Storage` references only `Domain`** (+ `Serialization`/`Common` transitively) — it does
> **not** reference `Application`. The secondary-port **interfaces** that `Storage` implements live in
> `Domain` alongside the pure DTOs they expose: `ISecretProtector`/`ISecretHasher` (`Domain.Security`),
> the statistics/test-run readers + writer (`Domain.Statistics`, with `TestRunStats` and the result
> records), the outlier readers + `OutlierSettings` (`Domain.Outliers`), `IEmailSettingsStore` +
> `EmailSettings` (`Domain.Notifications`), the stored-license store (`Domain.Licensing`),
> `IDatabaseInitializer` (`Domain.Demo`), `ITestDataReset` (`Domain.TestSupport`) and the audit-emit
> seam `Audit`/`LogAudit`/`AuditState` (`Domain.AuditLog`). The **implementations** (`Internal/*`),
> hosted services, and the audit *capture* pipeline stay in `Application` (issue #270).
>
> `Proxytrace.Infrastructure` depends only on `Domain` + `Serialization` (it has **no** reference to
> `Application`): the kiosk option records it needs (`KioskOptions`, `KioskEndpointOptions`) live in
> `Proxytrace.Domain.Kiosk`, and it now also hosts the at-rest secret seam's Data Protection-backed
> **implementation** + DI module (`Proxytrace.Infrastructure.Security.SecretProtectionModule`) — the
> lowest layer both the API host and the lean proxy can reach without `Application`. **Consequence:** the
> standalone `Proxytrace.Proxy` references `Storage` (+ `Infrastructure`, `Messaging`, `Domain`) and does
> **not** load the `Application` assembly at all, directly or transitively.

- **Proxytrace.Api** — ASP.NET Core controllers, DTOs, the OpenAI-compatible proxy endpoint, composition root (`Proxytrace.Api.Module`)
- **Proxytrace.Application** — Use-case orchestration: ingestion (`OpenAiCallParser`, `AgentCallIngestor`), test running (`TestRunnerService`), optimization, SSE broadcasters (`TraceBroadcaster`, `TestResultBroadcaster`, `ProposalBroadcaster`), demo data seeding (`IDatabaseInitializer`)
- **Proxytrace.Domain** — Business entities, interfaces, value objects, repository contracts. Pure C#, no I/O.
- **Proxytrace.Infrastructure** — External service integration. `ModelClient` wraps `Microsoft.Extensions.AI` + the OpenAI SDK to invoke LLMs.
- **Proxytrace.Serialization** — JSON serializers and output formats (`ISerializer`, `IOutputFormat`, `ObjectToInferredTypesConverter`).
- **Proxytrace.Storage** — EF Core entities, configurations, mappers, migrations. Provider auto-detected (SQLite / PostgreSQL / SQL Server).
- **Proxytrace.Common** — Shared utilities: validation helpers, async/type extensions, DI extensions, randomness.
- **Proxytrace.Proxy** — **Standalone** deployable OpenAI-compatible proxy service (own `Program`/`Dockerfile`/`Module`). On the request hot path it resolves the API key — **deliberately uncached**, straight from storage on every request, so provider-key rotation/revocation takes effect on the next request and the proxy fails closed when the database is unreachable rather than serving stale credentials (#407; the per-request cost is a few indexed point lookups, guarded by the `proxyResolve*` perf budgets) — evaluates the project's **blocking anomaly detectors** against the buffered request body (trigger match only; a hit rejects with an OpenAI-style 403 before any upstream contact and publishes the blocked call as a flagged trace), forwards to the upstream provider, and publishes the captured call to the ingestion stream. References Domain + Infrastructure + Messaging + Storage **+ Licensing** (it does **not** reference Api **or Application** — directly or transitively; `Licensing` depends only on `Common`, so this keeps the invariant). It deliberately constructs `Storage.Module` with `registerApplicationServices: false` and never registers `Application.Module`, so **no Application service runs in the proxy** (test runner, optimizer, ingestion worker, search indexing, demo seeder, …). It does still need the at-rest secret seam to decrypt the upstream provider key before replaying it, so it registers `Proxytrace.Infrastructure.Security.SecretProtectionModule` directly (the seam interfaces live in `Domain`, the Data Protection-backed implementation in `Infrastructure`), plus small local stubs for the factory delegates the storage model-building graph expects. The licensing module is registered with `ServerCheckEnabled = false` in **both** build flavors — the main app owns the license-server heartbeat and the offline-grace cache file in the shared data dir; the proxy only *consumes* the snapshot for use-time gating and keeps the DB-stored license fresh via a polling `ProxyStoredLicenseService`.
- **Proxytrace.Messaging** — Ingestion transport between the proxy (producer) and the app's ingestion worker (consumer), via `IIngestionStream`. Backed by **Redis Streams** in production (`StackExchange.Redis`); backed by an in-memory channel in tests and single-process/kiosk runs.
- **Proxytrace.Licensing** — License resolution and feature/limit gating via `ILicenseService`. Tiers, `LicenseFeature`/`LicenseLimit`, JWT public-key verification. See [`licensing.md`](licensing.md).
- **Proxytrace.Testing** — `BaseTest<TModule>` and shared test infrastructure (MSTest + AwesomeAssertions + NSubstitute).
- **Proxytrace.Client.Sample** — Console app demonstrating client-side usage of the API.
- **frontend/** — React 19 + Vite + Tailwind CSS 4 SPA.

## Ingestion flow

Trace capture is **decoupled** from the main app through the messaging stream:

```
Your Agent ──► Proxytrace.Proxy ──► Upstream LLM provider
                     │ (captures call)
                     ▼
              IIngestionStream  (Redis Streams in prod; in-memory otherwise)
                     │
                     ▼
        Application ingestion worker ──► AgentCallIngestor ──► Storage
```

`PublishAsync` is **fire-and-forget on the proxy hot path** — keep it cheap and never rely on it to surface processing errors. The consumer must `AckAsync` each `IngestEnvelope` only after processing succeeds. Recovery from a retryable failure depends on the transport (`IIngestionStream.RedeliversUnacknowledged`): Redis Streams redeliver unacknowledged envelopes, so the worker leaves the entry pending and caps redelivery attempts; the in-process channel drops anything unacked, so the worker retries inline (bounded) instead — otherwise a retryable failure would silently lose the captured call.

**No duplicate traces from reclaim.** On Redis the consumer runs `XAUTOCLAIM` each round to recover entries pending on a dead consumer. Two guards stop a slow-but-live persist from being reclaimed and double-processed into a duplicate trace row / SSE event / outlier eval (there is no idempotency key on `AgentCall`, and a content-unique index is unsafe because two identical calls must both persist): (1) `MessagingConfiguration.ReclaimIdleMs` is sized far above the worst-case single-envelope persist time so reclaim only ever targets a genuinely dead consumer; (2) `AgentCallIngestionWorker` tracks in-flight transport entry ids and skips any reclaimed duplicate that overlaps the still-in-flight original, which keeps the ack exactly-once. This dedup is per-instance and assumes a single ingestion-worker instance.

**The stream is only for the out-of-process producer.** The worker and an in-process producer share one core, `IIngestionExecutor` (quota → re-hydrate provider/project → `AgentCallProcessor`). The standalone **proxy** is a separate process, so it *must* publish to `IIngestionStream` to hand the call across the process boundary. The **Tracey chat passthrough** (`TraceyChatController`) runs **inside the app**, so it calls `IIngestionExecutor` **directly** — never the stream. Routing an in-process capture through Redis would make it depend on a transport it doesn't need and silently drop every Tracey trace whenever Redis is down. **Rule:** a same-process capture uses `IIngestionExecutor`; only the cross-process proxy uses `IIngestionStream`.

## Dependency Injection (Autofac)

DI is wired with Autofac. Each project ships a `Module : Autofac.Module` (`Proxytrace.Domain.Module`, `Proxytrace.Application.Module`, `Proxytrace.Storage.Module`, `Proxytrace.Infrastructure.Module`, `Proxytrace.Serialization.Module`, `Proxytrace.Common.Module`, `Proxytrace.Api.Module`, `Proxytrace.Testing.Module`). `Proxytrace.Domain.Module` and `Proxytrace.Storage.Module` discover entities, generators, configurations, and repositories by reflection — no manual registrations for the standard entity pattern. The API serves the compiled React app from `wwwroot/` in production.

`Proxytrace.Application.Module` registers the hosted services for ingestion + test running plus the optimization sub-module. `Proxytrace.Storage.Module` takes a `Func<IServiceProvider, StorageConfiguration>` (the configuration is auto-detected by `Proxytrace.Api.Module`) plus a `registerApplicationServices` flag (default `true`).

**The `registerApplicationServices` flag.** When `true` — the API/app host and the test/perf harnesses (`Storage.Tests`, `Domain.Tests`, `Application.Tests`, the perf harness) — `Storage.Module` registers Storage's own startup/initialization hosted services: the DB-initializer (`IDatabaseInitializer`) plus the secret/preview backfill services. The standalone **proxy** passes `false`: it attaches to an already-migrated database read-only and runs no schema init or backfills. Since [#270](https://github.com/Proxytrace/Proxytrace/issues/270), `Storage.Module` no longer references or registers `Application.Module` (the flag's name is historical) — each composition root that needs the Application graph (the API host plus the four `Storage.Tests` / `Domain.Tests` / `Application.Tests` / perf harnesses) registers `Application.Module` **and** the at-rest secret seam (`Infrastructure.Security.SecretProtectionModule`) explicitly. The API root's registrations are idempotent (the `IfNotRegistered`/`builder.Properties` guards make any double registration a no-op).
