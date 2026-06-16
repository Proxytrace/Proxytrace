# Domain Entity Pattern

Every domain concept requires **five files**:

| File | Location | Purpose |
|------|----------|---------|
| `I[Entity].cs` | `Proxytrace.Domain/[Entity]/` | Public interface declaring properties + `CreateNew`/`CreateExisting` delegates (extends `IDomainEntity`) |
| `[Entity].cs` | `Proxytrace.Domain/[Entity]/Internal/` | Immutable `internal record` implementing `I[Entity]`, extends `DomainEntity` |
| `[Entity]Generator.cs` | `Proxytrace.Domain/[Entity]/Internal/` | Test data factory, extends `DomainEntityGenerator<I[Entity]>` |
| `[Entity]Entity.cs` | `Proxytrace.Storage/Internal/Entities/[Entity]/` | EF `internal record` extending `Entity`, decorated with `[StoredDomainEntity(typeof(I[Entity]))]` |
| `[Entity]Config.cs` | `Proxytrace.Storage/Internal/Entities/[Entity]/` | Extends `AbstractEntityConfiguration<[Entity]Entity>`, implements `IMapper<I[Entity], [Entity]Entity>` |

A `I[Entity]Repository.cs` interface (in `Proxytrace.Domain/[Entity]/`) plus `[Entity]Repository.cs` (in `Proxytrace.Storage/Internal/Entities/[Entity]/`) is only needed for N:M relationships or non-trivial queries. Decorate the storage repository with `[UsedImplicitly]` so reflection-based DI picks it up.

`IDomainEntity` already provides `Id`, `CreatedAt`, `UpdatedAt` — do not redeclare them and do not introduce a separate `I[Entity]Data` interface.

## Domain entities vs domain objects

- **`IDomainEntity`** — persistent root with `Id`/`CreatedAt`/`UpdatedAt`. Has a storage entity, mapper, and repository.
- **`IDomainObject`** — value object with no identity (e.g. `IPromptTemplate`, `IPrompt`, `Message`, `ToolSpecification`, `TokenUsage`, `Conversation`). No storage entity; embedded in or serialized inside the parent's stored representation. Generators implement `IDomainObjectGenerator<T>` and are auto-registered alongside entity generators.

## Factory delegates

Each domain interface declares exactly two delegates. `CreateExisting` takes the same positional properties as `CreateNew` plus a trailing `IDomainEntityData existing`:
```csharp
public delegate IProject CreateNew(string name, IModelEndpoint systemEndpoint);
public delegate IProject CreateExisting(string name, IModelEndpoint systemEndpoint, IDomainEntityData existing);
```

## Domain entity constructors

Mirror the delegate signatures one-to-one:
```csharp
// New — base ctor assigns fresh Id, CreatedAt, UpdatedAt
public Project(string name, IModelEndpoint systemEndpoint)
{
    Name = name;
    SystemEndpoint = systemEndpoint;
}

// Existing — base(existing) copies Id, CreatedAt, UpdatedAt
public Project(string name, IModelEndpoint systemEndpoint, IDomainEntityData existing) : base(existing)
{
    Name = name;
    SystemEndpoint = systemEndpoint;
}
```

## Foreign key conventions

The boundary is sharp: **domain layer references the full entity, storage layer holds the `Guid`.**

- **1:N** — domain holds the parent as `IModelEndpoint SystemEndpoint { get; }`; storage holds `Guid SystemEndpoint`; mapper resolves the parent via the parent's repository in `Map(stored, ct)`. Configure with `HasOne<ModelEndpointEntity>().WithMany().HasForeignKey(e => e.SystemEndpoint).OnDelete(DeleteBehavior.Restrict)`.
- **N:M** — domain holds `IReadOnlyCollection<IEvaluator> Evaluators { get; }`; storage uses a junction entity (e.g. `TestSuiteEvaluatorEntity` with `TestSuiteId`/`EvaluatorId`) and a navigation collection on the parent storage entity. Junction entities have **no domain counterpart** and are registered explicitly in `Proxytrace.Storage.Module`. The custom repository overrides `UpdateRelationsAsync` to sync the junction rows during `Update` (see `TestSuiteRepository`).
- **Delete behavior** — `Restrict` for optional references, `Cascade` for owned children.

## Soft-delete (archive)

Config/model entities that historical data references by a stored id (live-fetched at map time)
must **not** be hard-deleted: the parent row vanishes while dependents keep pointing at it, so
either an FK `Restrict` blocks the delete or the dependent throws `EntityNotFoundException` when it
is next loaded. These entities **archive** instead — a reusable, opt-in soft-delete:

- **Domain** — the interface extends `IArchivable` (a marker on `IDomainEntity`). `IsArchived` lives
  on `IDomainEntityData` as a default-`false` member, so `DomainEntity` reads it from `existing` and
  every entity exposes it; only opted-in entities ever set it true. The custom repository interface
  extends `IArchivableRepository<T>` (adds `ArchiveAsync`).
- **Storage** — the entity record implements `IArchivableEntity` (adds the mapped `IsArchived`
  column; non-archivable entities get no column). The repository extends `ArchivableRepository`
  instead of `AbstractRepository`, which provides `ArchiveAsync` (flips the flag in its own
  transaction, then `Notify(..., Removed)`), filters archived rows out of `GetAllAsync`, and exposes
  `ArchiveRelationsAsync` for detaching forward-looking memberships (the soft-delete analogue of
  `UpdateRelationsAsync`).
- **Filtering rule (critical)** — **never use an EF global query filter.** A global filter also
  hides archived rows from by-id `GetAsync`/`GetManyAsync`, breaking the very history archiving
  protects. Filter archived **only** in true list/picker queries: call `.ExcludeArchived()` on each
  list/by-collection query (e.g. `GetByProjectAsync`). Leave **all by-key lookups unfiltered** —
  `GetAsync`/`GetManyAsync` *and* fingerprint/name resolution (`GetOrCreateAsync`, `FindByNameAsync`)
  — so history and traffic attribution keep resolving archived rows.
- **Controller** — the `Delete` endpoint calls `ArchiveAsync` and keeps the `204/404` contract, so
  the frontend (optimistic list-cache removal + archived-filtered refetch) needs no change.

**Adopters:**
- **`Evaluator`** — archiving deletes its `TestSuiteEvaluatorEntity` rows via `ArchiveRelationsAsync`
  so suites stop using it; past `TestResult` evaluations still resolve it by id.
- **`Agent`** — list query + the licensed-agent count (`CountNonSystemAsync`) exclude archived;
  versions/suites/calls are preserved (the `Cascade` no longer fires). The controller refuses to
  archive **system agents** (`IsSystemAgent`: Tracey, optimizers, agentic-evaluator judges) with a
  409. Ingestion attribution (`GetOrCreateAsync`/`FindByNameAsync`) is a by-key lookup, so an
  archived agent that receives matching traffic again still resolves.
- **`ModelEndpoint`** — the per-endpoint delete archives, preserving the `AgentCall`/`TestRun` rows a
  hard delete would have `Cascade`-removed. Reuse via `GetOrCreateAsync` (a by-key lookup)
  **un-archives** a matched archived endpoint (`ArchivableRepository.UnarchiveAsync`) so it never
  lingers as a live-but-hidden zombie.
- **`ModelProvider`** — the per-provider delete archives instead of hard-deleting, closing the former
  cascade-data-loss gap (a hard delete cascaded through the provider's endpoints to every
  `AgentCall`/`TestRun`). `ArchiveRelationsAsync` also archives the provider's endpoints so the whole
  provider leaves pickers together, while the history those endpoints back is preserved.
  `FindByApiKeyAsync` (the proxy's upstream-key auth) is a by-key lookup and stays unfiltered.

## Reference Implementations

When implementing a new entity, the existing ones are the source of truth:
- **No relationships:** `User`
- **1:N relationship:** `Project` references one `IModelEndpoint` (`SystemEndpoint`)
- **N:M relationship:** `TestSuite` holds `IReadOnlyCollection<IEvaluator>`, junction is `TestSuiteEvaluatorEntity`, custom `TestSuiteRepository` overrides `UpdateRelationsAsync`
- **Soft-delete (archive):** `Evaluator`, `Agent`, `ModelEndpoint`, `ModelProvider` (`IArchivable` + `ArchivableRepository`; list/paged queries exclude archived via the `FilterListQuery` hook + `.ExcludeArchived()`, by-key lookups unfiltered; `Evaluator` detaches suites and `ModelProvider` archives its endpoints in `ArchiveRelationsAsync`, `Agent` guards system agents + license count, `ModelEndpoint.GetOrCreateAsync` un-archives on reuse)

See also the `create-domain` skill for a step-by-step walkthrough.
