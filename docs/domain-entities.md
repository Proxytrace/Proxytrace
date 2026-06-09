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

## Reference Implementations

When implementing a new entity, the existing ones are the source of truth:
- **No relationships:** `User`
- **1:N relationship:** `Project` references one `IModelEndpoint` (`SystemEndpoint`)
- **N:M relationship:** `TestSuite` holds `IReadOnlyCollection<IEvaluator>`, junction is `TestSuiteEvaluatorEntity`, custom `TestSuiteRepository` overrides `UpdateRelationsAsync`

See also the `create-domain` skill for a step-by-step walkthrough.
