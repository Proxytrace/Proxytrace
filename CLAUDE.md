# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Trsr Is

Trsr is an AI agent observability platform that acts as an OpenAI-compatible proxy, capturing every LLM interaction, then lets teams curate those traces into benchmark test suites and generate data-driven optimization proposals. It is in an early architecture phase.

## Commands

### Backend (.NET 10)
```bash
dotnet restore Trsr.sln          # Restore packages
dotnet build Trsr.sln            # Build all projects
dotnet test Trsr.sln             # Run all tests
dotnet test Trsr.Domain.Tests    # Run a single test project
cd Trsr.Api && dotnet run        # Start API on http://localhost:5001
```

Swagger UI is available at `http://localhost:5001/swagger` in Development mode.

### EF Core Migrations (run from Trsr.Storage/)
```bash
dotnet ef migrations add <MigrationName>
dotnet ef database update
```

### Frontend (Angular 21, inside `frontend/`)
```bash
npm install
npm start           # Dev server on http://localhost:4200
npm run build       # Production build
npm test            # Vitest unit tests
```

### All-in-one dev mode
```bash
./dev.sh            # Starts backend (5001) + frontend (4201) with demo data seeded
```

## Architecture

Strict layered dependency flow — each layer may only depend on layers below it:

```
Trsr.Api  →  Trsr.Domain  →  Trsr.Common
Trsr.Storage  →  Trsr.Domain  →  Trsr.Common
```

- **Trsr.Api** — ASP.NET Core controllers, DTOs, services (ingestion, test runner, proxy)
- **Trsr.Domain** — Business entities, interfaces, value objects, repository contracts
- **Trsr.Storage** — EF Core entities, configurations, mappers, migrations
- **Trsr.Common** — Shared utilities: validation helpers, async extensions, DI extensions
- **Trsr.Testing** — `BaseTest<TModule>` and shared test infrastructure
- **frontend/** — Angular 21 standalone components with Tailwind CSS 4

The API serves the compiled Angular app in production (`wwwroot/`).

## Domain Entity Pattern

Every domain concept requires **six files**:

| File | Location | Purpose |
|------|----------|---------|
| `I[Entity]Data.cs` | `Trsr.Domain/[Entity]/` | Properties interface (extends `IDomainEntityData`) |
| `I[Entity].cs` | `Trsr.Domain/[Entity]/` | Entity interface + factory delegates (extends `IDomainEntity, I[Entity]Data`) |
| `[Entity].cs` | `Trsr.Domain/[Entity]/Internal/` | Immutable record implementing `I[Entity]`, extends `DomainEntity` |
| `[Entity]Generator.cs` | `Trsr.Domain/[Entity]/Internal/` | Test data factory, extends `DomainEntityGenerator<I[Entity]>` |
| `[Entity]Entity.cs` | `Trsr.Storage/Internal/Entities/[Entity]/` | EF record with `[StoredDomainEntity(typeof(I[Entity]))]` |
| `[Entity]Config.cs` | `Trsr.Storage/Internal/Entities/[Entity]/` | Extends `AbstractEntityConfiguration<T>`, implements `IMapper<I[Entity], [Entity]Entity>` |

A custom `[Entity]Repository.cs` is only needed for N:M relationships or non-trivial queries.

**No manual DI registration is ever needed.** `Trsr.Domain.Module` and `Trsr.Storage.Module` auto-register everything via reflection on startup.

### Factory delegates
Each domain interface defines exactly two delegates:
```csharp
public delegate IUser CreateNew(string name);         // for new entities
public delegate IUser CreateExisting(IUserData data); // for loading from storage
```

### Domain entity constructors
```csharp
// New entity — sets new Id, CreatedAt, UpdatedAt
public User(string name) { Name = name; }

// Existing entity — copies Id, CreatedAt, UpdatedAt from data
public User(IUserData existing) : base(existing) { Name = existing.Name; }
```

### Validation
Override `Validate()` on every domain entity and call `base.Validate()` first. Use helpers from `Trsr.Common.Validation`:
```csharp
Validation.NotNullOrWhitespace(Name, nameof(Name))
Validation.NotDefault(OrganizationId, nameof(OrganizationId))
Validation.InPast(CreatedAt, nameof(CreatedAt))
Validation.NotBefore(UpdatedAt, CreatedAt, nameof(UpdatedAt))
```

### Foreign key conventions
- **1:N** — store parent key as `Guid` property in domain; `HasOne<>().WithMany().HasForeignKey()` in config
- **N:M** — store as `IReadOnlyCollection<Guid>` in domain; storage entity has navigation property + computed property; requires junction entity and custom repository overriding Add/Update
- **Delete behavior** — use `Restrict` for optional references, `Cascade` for owned children
- Always `builder.Ignore(e => e.ComputedCollectionProperty)` for computed properties

## Testing Conventions

All tests extend `BaseTest<TModule>` (MSTest + AwesomeAssertions):

```csharp
[TestClass]
public class MyTests : BaseTest<Module>
{
    public required TestContext TestContext { get; init; }

    [TestMethod]
    public async Task SomeTest()
    {
        IServiceProvider services = GetServices();
        var repo = services.GetRequiredService<IRepository<IUser>>();
        var generator = services.GetRequiredService<IDomainEntityGenerator<IUser>>();

        IUser entity = await generator.CreateAsync(CancellationToken); // persists
        IUser result = await repo.GetAsync(entity.Id, CancellationToken);

        result.Id.Should().Be(entity.Id);
    }
}
```

- Each test gets an isolated in-memory database (unique name via `Guid.NewGuid()`)
- `CancellationToken` comes from `TestContext.CancellationToken`
- Override `ConfigureContainer(ContainerBuilder)` to customize the DI container for a test class
- Use `generator.GenerateAsync()` for in-memory-only test objects; `CreateAsync()` to persist

**Exception assertions:**
```csharp
// Async
await FluentActions
    .Invoking(() => repo.UpdateAsync(entity, CancellationToken))
    .Should().ThrowAsync<EntityNotFoundException>();

// Sync
var ex = await Assert.ThrowsAsync<EntityNotFoundException>(
    () => repo.GetAsync(nonExistentId));
ex.Should().NotBeNull();
```

## Key Conventions

- All timestamps are `DateTimeOffset`, never `DateTime`
- Domain entities are immutable records — no setters on domain-layer properties
- Repositories return domain entities (`I[Entity]`), never storage entities
- Always pass `CancellationToken` to every async method
- Use `IReadOnlyCollection<Guid>` for FK collections in domain interfaces, not navigation properties
- Storage entities use `required` properties with `init` accessors
- Decorate custom repositories with `[UsedImplicitly]` so Autofac discovers them

## Database Configuration

Provider is auto-detected from the connection string in `Trsr.Api/appsettings.json`:

| Provider | Connection string pattern |
|----------|--------------------------|
| SQLite | `Data Source=trsr.db` or `:memory:` |
| PostgreSQL | contains `Host=` or `Port=` |
| SQL Server | anything else (default) |

SQLite is recommended for local development (zero config). See `DATABASE.md` for full details.

## Reference Implementations

When implementing a new entity, refer to existing ones:
- **Simple entity (no relationships):** `User`
- **1:N relationship:** `Project` → `Organization`
- **N:M relationship:** `Organization` ↔ `User`

The complete step-by-step checklist for new entities is in `SKILL_CREATE_DOMAIN_ENTITY.md`.
