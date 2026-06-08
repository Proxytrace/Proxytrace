# Architecture

Strict layered dependency flow — each layer may only depend on layers below it:

```
Proxytrace.Api  →  Proxytrace.Application  →  Proxytrace.Domain  →  Proxytrace.Common
            →  Proxytrace.Infrastructure  →  Proxytrace.Serialization  →  Proxytrace.Common
            →  Proxytrace.Storage  →  Proxytrace.Application / Proxytrace.Domain
```

- **Proxytrace.Api** — ASP.NET Core controllers, DTOs, the OpenAI-compatible proxy endpoint, composition root (`Proxytrace.Api.Module`)
- **Proxytrace.Application** — Use-case orchestration: ingestion (`OpenAiCallParser`, `AgentCallIngestor`), test running (`TestRunnerService`), optimization, SSE broadcasters (`TraceBroadcaster`, `TestResultBroadcaster`, `ProposalBroadcaster`), demo data seeding (`IDatabaseInitializer`)
- **Proxytrace.Domain** — Business entities, interfaces, value objects, repository contracts. Pure C#, no I/O.
- **Proxytrace.Infrastructure** — External service integration. `ModelClient` wraps `Microsoft.Extensions.AI` + the OpenAI SDK to invoke LLMs.
- **Proxytrace.Serialization** — JSON serializers and output formats (`ISerializer`, `IOutputFormat`, `ObjectToInferredTypesConverter`).
- **Proxytrace.Storage** — EF Core entities, configurations, mappers, migrations. Provider auto-detected (SQLite / PostgreSQL / SQL Server).
- **Proxytrace.Common** — Shared utilities: validation helpers, async/type extensions, DI extensions, randomness.
- **Proxytrace.Proxy** — **Standalone** deployable OpenAI-compatible proxy service (own `Program`/`Dockerfile`/`Module`). On the request hot path it resolves the API key, forwards to the upstream provider, and publishes the captured call to the ingestion stream. References Domain + Messaging + Storage only — **not** Application or Api.
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

`PublishAsync` is **fire-and-forget on the proxy hot path** — keep it cheap and never rely on it to surface processing errors. The consumer must `AckAsync` each `IngestEnvelope` only after processing succeeds; unacknowledged envelopes are redelivered.

## Dependency Injection (Autofac)

DI is wired with Autofac. Each project ships a `Module : Autofac.Module` (`Proxytrace.Domain.Module`, `Proxytrace.Application.Module`, `Proxytrace.Storage.Module`, `Proxytrace.Infrastructure.Module`, `Proxytrace.Serialization.Module`, `Proxytrace.Common.Module`, `Proxytrace.Api.Module`, `Proxytrace.Testing.Module`). `Proxytrace.Domain.Module` and `Proxytrace.Storage.Module` discover entities, generators, configurations, and repositories by reflection — no manual registrations for the standard entity pattern. The API serves the compiled React app from `wwwroot/` in production.

`Proxytrace.Application.Module` takes `(bool isDevelopment, IConfiguration? configuration)` and registers hosted services for ingestion + test running plus the optimization sub-module. `Proxytrace.Storage.Module` takes a `StorageConfiguration` (auto-detected by `Proxytrace.Api.Module`).
