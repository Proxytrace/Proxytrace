# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Trsr Is

Trsr is an AI agent observability platform that acts as an OpenAI-compatible proxy, capturing every LLM interaction, then lets teams curate those traces into benchmark test suites and generate data-driven optimization proposals. It is in an early architecture phase.

## Development Workflow

All work follows an issue-based flow. Adhere to these steps in order:

1. **Start from a GitHub issue.** If the user names a specific issue, use it. If not, search existing issues with `gh issue list` for a matching one. If none exists, create one with `gh issue create` before doing any work.
2. **Clarify ambiguities before coding.** Read the issue in full. If anything is unclear — scope, expected behaviour, edge cases, design decisions — ask the user before writing any code. Do not make assumptions and discover them wrong mid-implementation.
3. **Develop on the feature branch.** Make all commits there; never commit directly to `master`.
4. (Backend Only) **Write tests.** For any new feature or bug fix, write a failing test that captures the expected behaviour before implementing the code to make it pass. This ensures correctness and prevents regressions.

## Working on UI

When implementing frontend features that require backend endpoints or methods that do not yet exist, create the missing controller action(s) or service method(s) as unimplemented stubs — throw `NotImplementedException` and leave the body empty. Do not implement backend logic. The user will implement the backend themselves.

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

#### Code Style
- Do not use primary constructors. Use constructor injection with DI and `this(...)` chaining for domain entities.
- Use `record` types for all domain entities and storage entities (even if mutable)
- Make types `internal` by default; only interfaces or POCO types should be `public`
- Use `required` properties with `init` accessors for storage entities
- Prefer immutability and statelessness; storage entities can be mutable if needed for EF Core
- Use `var` when the type is obvious from the right-hand side, otherwise be explicit
- Use expression-bodied members for simple one-liners; otherwise use block bodies with braces
- Use `this(...)` constructor chaining to avoid duplication between "new" and "existing" constructors on domain entities
- Use `nameof(...)` for all parameter names in exceptions and validation
- Prefer collection expressions when possible

### EF Core Migrations (run from Trsr.Storage/)
```bash
dotnet ef migrations add <MigrationName>
dotnet ef database update
```

### Frontend (Angular 21, inside `frontend/`)
```bash
npm install
npm start           # Dev server on http://localhost:4201
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

- **Trsr.Api** — ASP.NET Core controllers, DTOs, services (ingestion, test runner, OpenAI proxy)
- **Trsr.Domain** — Business entities, interfaces, value objects, repository contracts
- **Trsr.Storage** — EF Core entities, configurations, mappers, migrations
- **Trsr.Common** — Shared utilities: validation helpers, async extensions, DI extensions
- **Trsr.Testing** — `BaseTest<TModule>` and shared test infrastructure
- **frontend/** — Angular 21 standalone components with Tailwind CSS 4

DI is wired with Autofac. `Trsr.Domain.Module` and `Trsr.Storage.Module` discover entities, generators, configurations, and repositories by reflection — no manual registrations. The API serves the compiled Angular app in production (`wwwroot/`).

## Domain Entity Pattern

Every domain concept requires **five files**:

| File | Location | Purpose |
|------|----------|---------|
| `I[Entity].cs` | `Trsr.Domain/[Entity]/` | Public interface declaring properties + `CreateNew`/`CreateExisting` delegates (extends `IDomainEntity`) |
| `[Entity].cs` | `Trsr.Domain/[Entity]/Internal/` | Immutable `internal record` implementing `I[Entity]`, extends `DomainEntity` |
| `[Entity]Generator.cs` | `Trsr.Domain/[Entity]/Internal/` | Test data factory, extends `DomainEntityGenerator<I[Entity]>` |
| `[Entity]Entity.cs` | `Trsr.Storage/Internal/Entities/[Entity]/` | EF `internal record` extending `Entity`, decorated with `[StoredDomainEntity(typeof(I[Entity]))]` |
| `[Entity]Config.cs` | `Trsr.Storage/Internal/Entities/[Entity]/` | Extends `AbstractEntityConfiguration<[Entity]Entity>`, implements `IMapper<I[Entity], [Entity]Entity>` |

A `I[Entity]Repository.cs` interface (in `Trsr.Domain/[Entity]/`) plus `[Entity]Repository.cs` (in `Trsr.Storage/Internal/Entities/[Entity]/`) is only needed for N:M relationships or non-trivial queries. Decorate the storage repository with `[UsedImplicitly]` so reflection-based DI picks it up.

`IDomainEntity` already provides `Id`, `CreatedAt`, `UpdatedAt` — do not redeclare them and do not introduce a separate `I[Entity]Data` interface.

### Factory delegates
Each domain interface declares exactly two delegates. `CreateExisting` takes the same positional properties as `CreateNew` plus a trailing `IDomainEntityData existing`:
```csharp
public delegate IProject CreateNew(string name, IOrganization organization);
public delegate IProject CreateExisting(string name, IOrganization organization, IDomainEntityData existing);
```

### Domain entity constructors
Mirror the delegate signatures one-to-one:
```csharp
// New — base ctor assigns fresh Id, CreatedAt, UpdatedAt
public Project(string name, IOrganization organization)
{
    Name = name;
    Organization = organization;
}

// Existing — base(existing) copies Id, CreatedAt, UpdatedAt
public Project(string name, IOrganization organization, IDomainEntityData existing) : base(existing)
{
    Name = name;
    Organization = organization;
}
```

### Validation
Domain entities are validated by Autofac on activation (`OnActivated` runs `Validator.ValidateObject`) and again before repository `Add`/`Update`. Override `Validate(ValidationContext)` and yield `base.Validate(...)` first. Use helpers from `Trsr.Common.Validation`:
```csharp
Validation.NotNullOrWhiteSpace(Name, nameof(Name))   // note: capital S in "WhiteSpace"
Validation.NotNull(Organization, nameof(Organization))
Validation.NotDefault(SomeGuid, nameof(SomeGuid))
Validation.InPast(CreatedAt, nameof(CreatedAt))
Validation.NotBefore(UpdatedAt, CreatedAt, nameof(UpdatedAt))
```
For referenced entities, cascade validation: `foreach (var r in Organization.Validate(validationContext)) yield return r;`.

### Foreign key conventions
The boundary is sharp: **domain layer references the full entity, storage layer holds the `Guid`.**

- **1:N** — domain holds the parent as `IOrganization Organization { get; }`; storage holds `Guid Organization`; mapper resolves the parent via the parent's repository in `Map(stored, ct)`. Configure with `HasOne<OrganizationEntity>().WithMany().HasForeignKey(e => e.Organization).OnDelete(DeleteBehavior.Restrict)`.
- **N:M** — domain holds `IReadOnlyCollection<IUser> Users { get; }`; storage uses a junction entity (e.g. `OrganizationUserEntity` with `OrganizationId`/`UserId`) and a navigation collection on the parent storage entity. Junction entities have **no domain counterpart** and are registered explicitly in `Trsr.Storage.Module`. The custom repository overrides `UpdateRelationsAsync` to sync the junction rows during `Update` (see `OrganizationRepository`).
- **Delete behavior** — `Restrict` for optional references, `Cascade` for owned children.

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

**Exception assertions** — use `FluentActions.Invoking(...).Should().ThrowAsync<T>()`:
```csharp
await FluentActions
    .Invoking(() => repo.UpdateAsync(entity, CancellationToken))
    .Should().ThrowAsync<EntityNotFoundException>();
```

## Key Conventions

- All timestamps are `DateTimeOffset`, never `DateTime`
- Domain entities are immutable `internal record` types — no setters on domain-layer properties
- Domain interfaces are `public`; implementations and storage entities are `internal`
- Repositories return domain entities (`I[Entity]`), never storage entities
- Always pass `CancellationToken` to every async method
- Domain references hold the related entity (e.g. `IOrganization`, `IReadOnlyCollection<IUser>`); storage entities hold the `Guid` foreign key
- Storage entities use `required` properties with `init` accessors and extend `Entity`
- Decorate custom storage repositories with `[UsedImplicitly]` so reflection-based DI discovers them

## Database Configuration

Provider is auto-detected from the connection string in `Trsr.Api/appsettings.json`:

| Provider | Connection string pattern |
|----------|--------------------------|
| SQLite | `Data Source=trsr.db` or `:memory:` |
| PostgreSQL | contains `Host=` or `Port=` |
| SQL Server | anything else (default) |

SQLite is recommended for local development (zero config). See `DATABASE.md` for full details.

## Frontend Architecture

Angular 21 with strict standalone components — no NgModules. Layout:

- `src/app/core/api/` — typed HTTP services (`agents.service.ts`, `agent-calls.service.ts`, `providers.service.ts`, `statistics.service.ts`) and shared `models.ts`
- `src/app/core/shell/` — top-level chrome (nav, layout)
- `src/app/features/` — one folder per route: `dashboard`, `traces`, `agents`, `suites`, `runs`, `providers`. Each is a standalone component, lazy-loaded via `loadComponent` in `app.routes.ts`
- Tailwind CSS 4 via `@tailwindcss/vite`; component styles use `.scss` or `.css`
- Tests use Vitest (`*.spec.ts`) — not Karma/Jasmine

Backend endpoints are reached through the dev proxy when running `./dev.sh` (frontend 4201 → backend 5001).

## Reference Implementations

When implementing a new entity, the existing ones are the source of truth:
- **No relationships:** `User`
- **1:N relationship:** `Project` references one `IOrganization`
- **N:M relationship:** `Organization` holds `IReadOnlyCollection<IUser>`, junction is `OrganizationUserEntity`, custom `OrganizationRepository` overrides `UpdateRelationsAsync`
