# Creating a New Domain Entity in Trsr

Use this guide when implementing a new domain concept end-to-end. Follow the steps in order.
`ITestRunGroup` is the canonical reference implementation — read it when a pattern is unclear.

---

## Checklist

- [ ] Domain interface (`Trsr.Domain/[Entity]/I[Entity].cs`)
- [ ] Domain implementation (`Trsr.Domain/[Entity]/Internal/[Entity].cs`)
- [ ] Generator (`Trsr.Domain/[Entity]/Internal/[Entity]Generator.cs`)
- [ ] Repository interface if needed (`Trsr.Domain/[Entity]/I[Entity]Repository.cs`)
- [ ] Storage entity (`Trsr.Storage/Internal/Entities/[Entity]/[Entity]Entity.cs`)
- [ ] Storage config + mapper (`Trsr.Storage/Internal/Entities/[Entity]/[Entity]Config.cs`)
- [ ] Storage repository if needed (`Trsr.Storage/Internal/Entities/[Entity]/[Entity]Repository.cs`)
- [ ] EF Core migration
- [ ] Tests (`Trsr.Domain.Tests/[Entity]ValidationTests.cs`)

---

## Step 1 — Domain interface

File: `Trsr.Domain/[Entity]/I[Entity].cs`

Rules:
- `public interface` extending `IDomainEntity` (gives `Id`, `CreatedAt`, `UpdatedAt` for free — do not redeclare them)
- Two and only two factory delegates: `CreateNew` and `CreateExisting`
- `CreateExisting` has the same positional parameters as `CreateNew` plus a trailing `IDomainEntityData existing`
- 1:N parent references are the full domain interface (e.g. `ITestSuite Suite`), never a raw `Guid`
- No `IData` sub-interface — all properties live directly on the interface

```csharp
using Trsr.Domain.TestRun;
using Trsr.Domain.TestSuite;

namespace Trsr.Domain.TestRunGroup;

public interface ITestRunGroup : IDomainEntity
{
    public delegate ITestRunGroup CreateNew(ITestSuite suite);
    public delegate ITestRunGroup CreateExisting(
        ITestSuite suite,
        TestRunStatus status,
        DateTimeOffset? completedAt,
        IDomainEntityData existing);
    
    ITestSuite Suite { get; }
    TestRunStatus Status { get; }
    DateTimeOffset? CompletedAt { get; }

    Task<ITestRunGroup> SetRunning(CancellationToken cancellationToken = default);
    Task<ITestRunGroup> SetCompleted(CancellationToken cancellationToken = default);
    Task<ITestRunGroup> SetFailed(CancellationToken cancellationToken = default);
    Task<ITestRunGroup> SetCancelled(CancellationToken cancellationToken = default);
}
```

---

## Step 2 — Domain implementation

File: `Trsr.Domain/[Entity]/Internal/[Entity].cs`

Rules:
- `internal sealed record` extending `DomainEntity<I[Entity]>` and implementing `I[Entity]`
- Two constructors that mirror the factory delegates exactly:
  - "new" constructor calls `base(repository)` — DI injects `IRepository<I[Entity]>`
  - "existing" constructor calls `base(existing, repository)`
- No primary constructors — use classic constructor injection
- All properties are get-only (set in constructor body) 
- We use immutability by convention!
- `Validate` yields `base.Validate(...)` first, then cascades into referenced entities
- Mutation methods return a new record instance via `repository.UpdateAsync(...)` — never mutate in place

```csharp
internal record TestRunGroup : DomainEntity<ITestRunGroup>, ITestRunGroup
{
    public ITestSuite Suite { get; }
    public TestRunStatus Status { get; }
    public DateTimeOffset? CompletedAt { get; }

    public TestRunGroup(
        ITestSuite suite, 
        IRepository<ITestRunGroup> repository) : base(repository)
    {
        Suite = suite;
        Status = TestRunStatus.Pending;
        CompletedAt = null;
    }

    public TestRunGroup(
        ITestSuite suite,
        TestRunStatus status,
        DateTimeOffset? completedAt,
        IDomainEntityData existing,
        IRepository<ITestRunGroup> repository) : base(existing, repository)
    {
        Suite = suite;
        Status = status;
        CompletedAt = completedAt;
    }

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
            yield return result;
        // cascade into owned references:
        foreach (var result in Suite.Validate(validationContext))
            yield return result;
        if(CompletedAt.HasValue) 
        {
            yield return Validation.InPast(CompletedAt.Value);
        }
    }

    public Task<ITestRunGroup> SetRunning(CancellationToken ct = default)
        => SetState(TestRunStatus.Running, ct);

    // ... other transition methods ...

    private Task<ITestRunGroup> SetState(TestRunStatus state, CancellationToken ct)
    {
        if (IsTerminal(Status))
            throw new InvalidOperationException($"Cannot change group {Id} from {Status} to {state}.");

        DateTimeOffset? completedAt = IsTerminal(state) ? DateTimeOffset.UtcNow : null;
        var updated = new TestRunGroup(Suite, state, completedAt, this, repository);
        return repository.UpdateAsync(updated, ct);
    }

    private static bool IsTerminal(TestRunStatus s)
        => s is TestRunStatus.Completed or TestRunStatus.Failed or TestRunStatus.Cancelled;
}
```

### Validation helpers (from `Trsr.Common.Validation`)

```csharp
yield return Validation.NotNullOrWhiteSpace(Name);  // note capital S
yield return Validation.NotNull(Suite);
yield return Validation.NotDefault(SomeGuid);
yield return Validation.InPast(CreatedAt);
yield return Validation.NotBefore(UpdatedAt, CreatedAt);
...
```

---

## Step 3 — Generator

File: `Trsr.Domain/[Entity]/Internal/[Entity]Generator.cs`

The generator is used exclusively by the test infrastructure. 
It must be able to produce a valid, self-contained instance.
GenerateAsync calls produce instances, but do not persist them.
CreateAsync must persist it.

```csharp
internal class TestRunGroupGenerator : DomainEntityGenerator<ITestRunGroup>
{
    private readonly ITestRunGroup.CreateNew factory;
    private readonly IDomainEntityGenerator<ITestSuite> suiteGenerator;

    public TestRunGroupGenerator(
        ITestRunGroup.CreateNew factory,
        IRepository<ITestRunGroup> repository,
        IDomainEntityGenerator<ITestSuite> suiteGenerator,
        IRandom random) : base(repository, random)
    {
        this.factory = factory;
        this.suiteGenerator = suiteGenerator;
    }

    public override async Task<ITestRunGroup> GenerateAsync(CancellationToken ct = default)
    {
        var suite = await suiteGenerator.GetOrCreateAsync(ct);
        return factory(suite);
    }
}
```

Rules:
- Constructor takes `IRepository<I[Entity]>` and `IRandom` (required by base) plus any generators for referenced entities
- `GenerateAsync` calls `GetOrCreateAsync` on referenced generators to avoid creating redundant rows
- Call `CreateAsync` instead when the test genuinely needs a fresh independent instance

---

## Step 4 — Repository interface (only if needed)

File: `Trsr.Domain/[Entity]/I[Entity]Repository.cs`

Only create this if you need queries beyond the standard CRUD that `IRepository<T>` already provides — e.g. filtering by a parent entity:

```csharp
public interface ITestRunGroupRepository : IRepository<ITestRunGroup>
{
    Task<IReadOnlyList<ITestRunGroup>> GetByAgentAsync(
        Guid agentId,
        CancellationToken cancellationToken = default);
}
```

If you only need `GetAsync`, `AddAsync`, `UpdateAsync`, etc., skip this file and use `IRepository<I[Entity]>` directly.

---

## Step 5 — Storage entity

File: `Trsr.Storage/Internal/Entities/[Entity]/[Entity]Entity.cs`

Rules:
- `internal record` extending `Entity`
- Decorated with `[StoredDomainEntity(typeof(I[Entity]))]` — this is what reflection-based DI uses
- **FK columns are `Guid`, not the domain interface** — the inverse of the domain layer
- `required` properties with `init` accessors
- No navigation properties unless needed for EF Core N:M join tables

```csharp
[StoredDomainEntity(typeof(ITestRunGroup))]
internal record TestRunGroupEntity : Entity
{
    public required Guid Suite { get; init; }
    public required TestRunStatus Status { get; init; }
    public DateTimeOffset? CompletedAt { get; init; }
}
```

---

## Step 6 — Storage config and mapper

File: `Trsr.Storage/Internal/Entities/[Entity]/[Entity]Config.cs`

Rules:
- Extends `AbstractEntityConfiguration<[Entity]Entity>`
- Also implements `IMapper<I[Entity], [Entity]Entity>` — one class does both jobs
- Constructor takes repositories for any referenced entities plus the `CreateExisting` factory and `ISerializer` if JSON columns are needed
- `Configure` sets up FK relationships — use `DeleteBehavior.Cascade` for owned children, `DeleteBehavior.Restrict` for optional references
- `Map(stored → domain)` loads referenced entities from their repositories (parallel with `Task.WhenAll` when there are multiple)
- `Map(domain → stored)` is a pure synchronous projection wrapped in `.ToTaskResult()`

```csharp
internal class TestRunGroupConfig
    : AbstractEntityConfiguration<TestRunGroupEntity>,
      IMapper<ITestRunGroup, TestRunGroupEntity>
{
    private readonly IRepository<ITestSuite> suites;
    private readonly ITestRunGroup.CreateExisting factory;

    public TestRunGroupConfig(IRepository<ITestSuite> suites, ITestRunGroup.CreateExisting factory)
    {
        this.suites = suites;
        this.factory = factory;
    }

    public override void Configure(EntityTypeBuilder<TestRunGroupEntity> builder)
    {
        builder
            .HasOne<TestSuiteEntity>()
            .WithMany()
            .HasForeignKey(e => e.Suite)
            .OnDelete(DeleteBehavior.Cascade);
    }

    public async Task<ITestRunGroup> Map(TestRunGroupEntity stored, CancellationToken ct = default)
        => factory(
            suite: await suites.GetAsync(stored.Suite, ct),
            status: stored.Status,
            completedAt: stored.CompletedAt,
            existing: stored);

    public Task<TestRunGroupEntity> Map(ITestRunGroup domain, CancellationToken ct = default)
        => new TestRunGroupEntity
        {
            Id = domain.Id,
            Suite = domain.Suite.Id,
            Status = domain.Status,
            CompletedAt = domain.CompletedAt,
            CreatedAt = domain.CreatedAt,
            UpdatedAt = domain.UpdatedAt,
        }.ToTaskResult();
}
```

### FK delete behaviour

| Relationship | `OnDelete` |
|---|---|
| Owned child (entity can't exist without parent) | `Cascade` |
| Optional / shared reference | `Restrict` |

### Parallel loading pattern (multiple FK references)

```csharp
public async Task<IMyEntity> Map(MyEntity stored, CancellationToken ct = default)
{
    var parentTask = parents.GetAsync(stored.Parent, ct);
    var otherTask  = others.GetAsync(stored.Other, ct);
    await Task.WhenAll(parentTask, otherTask);
    return factory(parentTask.Result, otherTask.Result, stored);
}
```

---

## Step 7 — Storage repository (only if needed)

File: `Trsr.Storage/Internal/Entities/[Entity]/[Entity]Repository.cs`

Rules:
- `internal class` extending `AbstractRepository<I[Entity], [Entity]Entity>`
- Implements the custom repository interface from Step 4
- **Must be decorated with `[UsedImplicitly]`** — reflection-based DI won't find it otherwise
- Use `AsNoTracking()` on all read queries

```csharp
[UsedImplicitly]
internal class TestRunGroupRepository
    : AbstractRepository<ITestRunGroup, TestRunGroupEntity>,
      ITestRunGroupRepository
{
    public TestRunGroupRepository(
        IMapper<ITestRunGroup, TestRunGroupEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction) : base(mapper, contextFactory, transaction) { }

    public async Task<IReadOnlyList<ITestRunGroup>> GetByAgentAsync(
        Guid agentId,
        CancellationToken ct = default)
    {
        var context = contextFactory();
        var stored = await context
            .Set<TestRunGroupEntity>()
            .AsNoTracking()
            .Join(context.Set<TestSuiteEntity>(),
                g => g.Suite,
                s => s.Id,
                (g, s) => new { Group = g, Suite = s })
            .Where(x => x.Suite.Agent == agentId)
            .Select(x => x.Group)
            .ToListAsync(ct);

        return await Map(stored, ct);
    }
}
```

---

## Step 8 — EF Core migration

Run from `Trsr.Storage/`:

```bash
dotnet ef migrations add Add[Entity]
```

EF generates the structural migration automatically. If the migration needs to backfill existing rows (e.g. creating a parent record for each existing child), add raw SQL after the `CreateTable` call:

```csharp
// After CreateTable(...)
migrationBuilder.Sql(@"
    INSERT INTO [Entity]Entity (Id, Suite, Status, CreatedAt, UpdatedAt)
    SELECT Id, ""FkColumn"", 0, CreatedAt, UpdatedAt
    FROM OtherEntity;
");

migrationBuilder.Sql(@"
    UPDATE OtherEntity SET ""FkColumn"" = Id;
");
```

Always verify the generated migration file before applying it — check column types, nullable settings, and that FKs point to the right tables.

---

## Step 9 — Tests

File: `Trsr.Domain.Tests/[Entity]ValidationTests.cs`

See `/test` for the full test-writing guide. For a new domain entity, cover: `CreateNew` happy path, null/invalid inputs, unique IDs, `CreateExisting` round-trip, state-machine transitions (valid and terminal-state violations), and persistence reloads. `TestRunGroupValidationTests` is the canonical reference.

---

## Common mistakes

| Mistake | Correct approach |
|---|---|
| `new MyEntity(...)` in production code | Resolve `I[Entity].CreateNew` from DI |
| Putting `Suite` on both parent and child | Suite lives at exactly one level |
| Forgetting `[UsedImplicitly]` on the repository | Reflection-based DI silently skips it |
| `DeleteBehavior.Cascade` on a shared reference | Use `Restrict`; `Cascade` only for owned children |
| Mutating state in-place | Return `repository.UpdateAsync(new Record(...), ct)` |
| Forgetting `[StoredDomainEntity(...)]` | Entity won't be discovered by the storage module |
| Loading FK targets sequentially | Use `Task.WhenAll` in the mapper |
