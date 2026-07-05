# Onion Architecture with Module-Based Composition

Medium-to-large backends rot when any code can call any other code: business rules leak into HTTP handlers, storage details leak into domain logic, and eventually nothing can be tested or replaced in isolation. The cure is the **onion architecture**: concentric rings around a pure domain core, a one-way dependency rule pointing inward, physical (per-project) ring boundaries, and per-project DI modules composing the rings at the edge. This document distills that shape into reusable patterns.

## The onion model

The architecture is a set of concentric rings; every reference points **inward**, never outward, never sideways:

```
        ┌──────────────────────────────────────────────┐
        │  Host / API  (composition root, controllers) │
        │  ┌─────────────┐  ┌─────────┐  ┌──────────┐  │
        │  │ Application │  │ Storage │  │ Infra-   │  │   outer ring:
        │  │ (use cases) │  │ adapter │  │ structure│  │   adapters +
        │  └──────┬──────┘  └────┬────┘  └────┬─────┘  │   orchestration
        │         ▼              ▼            ▼        │
        │  ┌──────────────────────────────────────┐    │
        │  │            Domain core               │    │   inner ring:
        │  │  immutable, interface-abstracted     │    │   entities, value
        │  │  entities · ports · validation       │    │   objects, ports
        │  └──────────────────┬───────────────────┘    │
        │                     ▼                        │
        │  ┌──────────────────────────────────────┐    │
        │  │   Common (pure shared utilities)     │    │   center
        │  └──────────────────────────────────────┘    │
        └──────────────────────────────────────────────┘
```

- **Center — Common utilities:** validation guards, extensions; depends on nothing.
- **Inner ring — Domain core:** entities, value objects, repository contracts, port interfaces, domain validation. Pure code, no I/O, no framework types. Its entities are **immutable** and exposed **only through interfaces** (see the dedicated principle below and `domain-modeling.md`).
- **Outer ring — Application + adapters:** use-case orchestration (application services) and, as *siblings that never reference each other*, the adapters: storage (ORM, migrations), infrastructure (external service clients), messaging, serialization. All of them depend on the domain; none depends on another sibling.
- **Edge — Hosts:** deployables/composition roots (API host, lean sidecar, test harness). The only place allowed to see every ring; contain wiring, transport DTOs, and nothing the inner rings would want back.

## Principles

1. **Dependencies point inward, and only inward.** The domain core depends on nothing but shared utilities. Application logic depends on the domain. Adapters (storage, external services, transport) depend on the domain — never on each other, and never on the application layer. The host/API layer is the only place allowed to see everything.
   1a. **The core of the onion is immutable and interface-abstracted.** Domain entities are exposed to every other ring exclusively as *public interfaces*; the implementing types are *internal, immutable* records constructed only through factory delegates. Outer rings can read and compose domain state but can never mutate it in place or bind to a concrete class. This single decision is what keeps the core pure: an entity that cannot change under you needs no defensive copies, is safe to cache and share across threads, and can only be "changed" by explicitly constructing a successor instance — which forces every state transition through construction-time validation. See `domain-modeling.md` for the full pattern and examples.
2. **Enforce layering with physical boundaries, not convention.** Separate compilation units (projects/packages) make an illegal dependency a build error instead of a code-review argument. A layering rule that lives only in people's heads will be violated within a quarter.
3. **Interfaces live where their *consumers* are; implementations live where their *dependencies* are.** A storage adapter implements interfaces declared in the domain (ports and adapters). This is what lets the adapter avoid referencing upper layers.
4. **Every project owns its DI wiring.** Each project ships exactly one DI module that registers that project's services. Composition roots (hosts, test harnesses) assemble the app by stacking modules, not by re-listing individual services.
5. **Deployables are composition roots, and lean ones stay lean.** A second deployable (a sidecar, a worker, a hot-path proxy) composes only the modules it needs. If it can run without loading the heavy application assembly at all, the layering is working.
6. **Cross-process boundaries are explicit seams.** Communication between deployables goes through a named transport abstraction (e.g. an ingestion stream) with a swappable backing (durable broker in production, in-memory channel in tests/single-process mode). In-process callers must *not* route through the cross-process transport.
7. **Cross-cutting concerns get their own small modules.** Secret protection, licensing, messaging, serialization: each is its own project + module with minimal dependencies, so any composition root — including the lean ones — can register it independently.

## Patterns

### One-way layer graph

- **Problem:** without a rule, dependencies form a cycle-ridden ball of mud; nothing can be extracted, replaced, or tested alone.
- **Solution:** define an explicit graph and write it down in an architecture doc, e.g.:

  ```
  Host/API ─► Application ─► Domain ─► Common
       └────► Storage ───────► Domain
       └────► Infrastructure ─► Domain (+ Serialization)
  ```

  Each arrow is a compile-time reference; anything not drawn is forbidden. Sibling adapters (Storage, Infrastructure, Messaging) never reference each other or Application.
- **Rationale:** the graph is the contract. When someone needs a type "from the wrong side", the compiler forces the correct fix — move the *interface* down into the domain — instead of the corrupting fix (add a reference).

### Ports in the core, adapters at the edge

- **Problem:** the storage/infrastructure layer needs to expose capabilities (statistics readers, settings stores, secret protection) that application code consumes; a naive design makes Application depend on Storage or vice versa.
- **Solution:** declare the port interface and its pure DTOs in the domain layer (`Domain.Security.ISecretProtector`, `Domain.Statistics.IStatsReader`, …). The adapter project implements them internally. Consumers inject the interface.
- **Rationale:** the domain stays I/O-free but *owns the vocabulary*. Adapters become replaceable (swap DB providers, swap crypto backends) and the lean deployable can pick up exactly the adapter modules it needs.

### Per-project DI module + explicit composition root

- **Problem:** a single giant `Startup`/`main` wiring file becomes an unreviewable dumping ground and hides which deployable needs which services.
- **Solution:** each project exports one module (`Autofac.Module`, a Spring `@Configuration`, a Go wire provider set, …). The host's module registers the modules of the layers it composes. Illustration (C#/Autofac as one instantiation):

  ```csharp
  public sealed class Module : Autofac.Module
  {
      protected override void Load(ContainerBuilder builder)
      {
          builder.RegisterModule<Domain.Module>();
          builder.RegisterModule<Storage.Module>();
          builder.RegisterModule<Application.Module>();
          // host-only services…
      }
  }
  ```
- **Rationale:** the module is the project's public wiring API. Test harnesses reuse the same modules as production, so tests exercise the real object graph, and a new deployable is "pick your modules" rather than "copy 400 registrations".

### Convention-based registration for repeating patterns

- **Problem:** a codebase with a repeatable entity pattern (interface + implementation + mapper + repository per concept) accumulates hundreds of near-identical manual registrations; people forget one and get a runtime failure far from the cause.
- **Solution:** the domain and storage modules discover pattern participants by reflection/scanning (all interfaces extending the entity marker, all mappers, all repositories) and register them mechanically. Fail fast at container build if a participant is missing (e.g. an entity without its test-data generator throws during startup).
- **Rationale:** adding entity N+1 costs zero wiring and cannot be half-wired. The "missing piece" error moves from an obscure runtime resolve failure to a loud startup failure with a precise message.

### Configurable module behavior instead of forked modules

- **Problem:** two composition roots need *almost* the same module — e.g. the main app must run migrations and backfill services, while a lean sidecar attaches read-only to an already-migrated DB.
- **Solution:** give the module explicit constructor parameters/flags (`registerStartupServices: false`) rather than duplicating it. Make host-level registrations idempotent (register-if-not-registered guards) so stacking modules never double-registers.
- **Rationale:** one module stays the single source of truth for that project's wiring; the flags document exactly how deployables differ.

### Lean deployable on the hot path

- **Problem:** putting the latency-sensitive component (a proxy, an ingest endpoint) inside the monolith couples its availability and startup cost to every background feature.
- **Solution:** make it a standalone deployable that references only Domain + the few adapter modules it needs, deliberately excluding the application assembly. Hand captured work to the main app via the messaging seam; on the hot path, publish is fire-and-forget.
- **Rationale:** the hot path cannot be slowed or broken by an unrelated application service, and the exclusion is verifiable ("this process never loads assembly X").

### In-process vs cross-process capture rule

- **Problem:** once a durable stream exists, it is tempting to route *everything* through it — including same-process callers — adding a broker dependency where none is needed and silently losing data when the broker is down.
- **Solution:** factor the shared core into an executor interface. The out-of-process producer publishes to the stream; the stream consumer and every in-process caller invoke the executor directly. State the rule in the docs: *same-process work calls the executor; only cross-process producers use the stream.*
- **Rationale:** transports are for crossing process boundaries, not for decoration. Also design the consumer around the transport's delivery guarantees (redelivery vs drop-on-crash) — the retry strategy must differ per backing, or you silently lose or duplicate work.

## Pitfalls

- **Interfaces placed next to their implementations.** If the port lives in the adapter project, consumers must reference the adapter and the seam is fake.
- **Adapter-to-adapter references** ("Storage just needs one helper from Infrastructure"). This is how the layer graph degrades; move the shared piece down to Domain or Common.
- **Grandfathered upward references documented nowhere.** If a violation must temporarily exist, track it as an issue with a plan; otherwise it becomes load-bearing.
- **A composition root that "just registers everything".** Lean deployables then silently start background workers they were never meant to run.
- **Convention-based discovery without fail-fast checks.** Silent non-registration is worse than manual wiring; scanning must throw when a pattern participant is absent.
- **Using the durable stream as a general-purpose event bus.** Keep it a point-to-point handoff with clear ack semantics; broadcast concerns deserve their own seam.
- **Architecture doc drift.** The layer graph doc must be updated in the same change that alters it — a stale diagram is actively harmful because people trust it.

## Checklist for a new project

- [ ] Draw the onion (ring diagram + layer graph) before writing code; encode it as separate projects/packages so violations fail the build.
- [ ] Make the domain core pure: no I/O, no framework types; entities immutable and exposed only via public interfaces with internal implementations (see `domain-modeling.md`).
- [ ] Create a `Common`/utility package with zero inward dependencies; keep it small.
- [ ] Put all port interfaces + their DTOs in the domain layer; keep the domain free of I/O and framework types.
- [ ] Give every project exactly one DI module; hosts compose modules, never individual services from other projects.
- [ ] Reuse production modules in the test harness so tests run the real graph.
- [ ] For repeating patterns, add convention-based registration with a fail-fast check for missing participants.
- [ ] Parameterize modules (flags/options) instead of forking them for a second deployable.
- [ ] If there is a latency-critical component, make it a separate deployable that excludes the application layer; verify the exclusion (it must not load that assembly/package).
- [ ] Define the cross-process transport as an interface with a durable production backing and an in-memory test backing; document ack/redelivery semantics and the "in-process callers bypass the stream" rule.
- [ ] Write the architecture doc alongside the first commit and treat updating it as part of the definition of done.
