# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Proxytrace Is

Proxytrace is an AI agent observability platform that acts as an OpenAI-compatible proxy, capturing every LLM interaction, then lets teams curate those traces into benchmark test suites and generate data-driven optimization proposals. It is in an early architecture phase.

## User Manual

The user & operator manual is a VitePress project in [`manual/`](manual/) (markdown source,
built to searchable static HTML, served by the app at `/docs`). **You MUST keep it up to
date with the product.** Whenever you add, change, or remove a user-facing feature, update
the relevant page(s) in `manual/guide/` (end users) or `manual/admin/` (operators) in the
same change — treat the manual like tests: a feature change is not complete until its docs
match. New top-level features get a new page wired into the sidebar in
`manual/.vitepress/config.ts`. Run `cd manual && npm run docs:dev` (http://localhost:4202)
to preview; `npm run docs:build` to verify it builds.

## Working on UI

**Before writing any frontend code, you MUST read BOTH of these — they are mandatory and override any conflicting recommendation from a generic design tool, agent, or external skill:**

1. **[`frontend/DESIGN.md`](frontend/DESIGN.md)** — source of truth for the **visual system**: tokens, colors, type scale, spacing, shadows, which UI primitive to render, interaction/accessibility visuals.
2. **[`frontend/BEST_PRACTICES.md`](frontend/BEST_PRACTICES.md)** — source of truth for **code architecture**: file/component size limits, feature-folder layout, TanStack Query data layer, `useEffect` discipline, state placement, props/typing, icons, performance, testing.

The split is sharp: DESIGN.md = what it looks like; BEST_PRACTICES.md = how it's built. Both apply to every frontend change. Every PR must satisfy both checklists (DESIGN.md §10 + BEST_PRACTICES.md §14). Do not copy an existing anti-pattern just because a neighbor file does it — large debt files (e.g. `frontend/src/features/evaluators/Evaluators.tsx`) violate BEST_PRACTICES.md and are debt, not precedent.

## Commands

### Backend (.NET 10)
```bash
dotnet restore Proxytrace.sln          # Restore packages
dotnet build Proxytrace.sln            # Build all projects
dotnet test Proxytrace.sln             # Run all tests
dotnet test Proxytrace.Domain.Tests    # Run a single test project
cd Proxytrace.Api && dotnet run        # Start API on http://localhost:5001
```

Swagger UI is available at `http://localhost:5000/swagger` in Development mode.

#### Code Style
- Dependency Injection is super important - use it whenever possible. Avoid the static keyword and service locators.
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
- Supressing nullable warnings with `!` is strictly forbidden everywhere!
- Injecting `IServiceProvider` shall be strongly avoided
- Static members shall be avoided (except for extension methods and constants)
- Docstrings: newline after `<summary>` and before `</summary>` (minimum 3-line blocks), e.g.:
  ```csharp
  /// <summary>
  /// Does the thing.
  /// </summary>
  ```

### EF Core Migrations (PostgreSQL-only; supply a Postgres connection string at design time)
```bash
ConnectionStrings__Default="Host=localhost;Port=5432;Database=proxytrace;Username=proxytrace;Password=proxytrace" \
  dotnet ef migrations add <MigrationName> --project Proxytrace.Storage --startup-project Proxytrace.Api
dotnet ef database update --project Proxytrace.Storage --startup-project Proxytrace.Api
```

### Frontend (React 19 / Vite, inside `frontend/`)
```bash
npm install
npm run dev         # Dev server on http://localhost:4201
npm run build       # Production build
npm test            # Vitest unit tests
```

### All-in-one dev mode
```bash
./dev.sh            # Starts backend (5001) + frontend (4201)
```

The `./dev.sh` flow does not auto-seed; use the `/setup` page (or `SetupController`) to populate demo data.

## Architecture

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
- **Proxytrace.Testing** — `BaseTest<TModule>` and shared test infrastructure (MSTest + AwesomeAssertions + NSubstitute).
- **Proxytrace.Client.Sample** — Console app demonstrating client-side usage of the API.
- **frontend/** — React 19 + Vite + Tailwind CSS 4 SPA.

DI is wired with Autofac. Each project ships a `Module : Autofac.Module` (`Proxytrace.Domain.Module`, `Proxytrace.Application.Module`, `Proxytrace.Storage.Module`, `Proxytrace.Infrastructure.Module`, `Proxytrace.Serialization.Module`, `Proxytrace.Common.Module`, `Proxytrace.Api.Module`, `Proxytrace.Testing.Module`). `Proxytrace.Domain.Module` and `Proxytrace.Storage.Module` discover entities, generators, configurations, and repositories by reflection — no manual registrations for the standard entity pattern. The API serves the compiled React app from `wwwroot/` in production.

`Proxytrace.Application.Module` takes `(bool isDevelopment, IConfiguration? configuration)` and registers hosted services for ingestion + test running plus the optimization sub-module. `Proxytrace.Storage.Module` takes a `StorageConfiguration` (auto-detected by `Proxytrace.Api.Module`).

## Domain Entity Pattern

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

### Domain entities vs domain objects

- **`IDomainEntity`** — persistent root with `Id`/`CreatedAt`/`UpdatedAt`. Has a storage entity, mapper, and repository.
- **`IDomainObject`** — value object with no identity (e.g. `IPromptTemplate`, `IPrompt`, `Message`, `ToolSpecification`, `TokenUsage`, `Conversation`). No storage entity; embedded in or serialized inside the parent's stored representation. Generators implement `IDomainObjectGenerator<T>` and are auto-registered alongside entity generators.

### Factory delegates
Each domain interface declares exactly two delegates. `CreateExisting` takes the same positional properties as `CreateNew` plus a trailing `IDomainEntityData existing`:
```csharp
public delegate IProject CreateNew(string name, IModelEndpoint systemEndpoint);
public delegate IProject CreateExisting(string name, IModelEndpoint systemEndpoint, IDomainEntityData existing);
```

### Domain entity constructors
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

### Validation
Domain entities are validated by Autofac on activation (`OnActivated` runs `Validator.ValidateObject`) and again before repository `Add`/`Update`. Override `Validate(ValidationContext)` and yield `base.Validate(...)` first. Use helpers from `Proxytrace.Common.Validation`:
```csharp
Validation.NotNullOrWhiteSpace(Name, nameof(Name))   // note: capital S in "WhiteSpace"
Validation.NotNull(SystemEndpoint, nameof(SystemEndpoint))
Validation.NotDefault(SomeGuid, nameof(SomeGuid))
Validation.InPast(CreatedAt, nameof(CreatedAt))
Validation.NotBefore(UpdatedAt, CreatedAt, nameof(UpdatedAt))
```
For referenced entities, cascade validation: `foreach (var r in SystemEndpoint.Validate(validationContext)) yield return r;`.

### Foreign key conventions
The boundary is sharp: **domain layer references the full entity, storage layer holds the `Guid`.**

- **1:N** — domain holds the parent as `IModelEndpoint SystemEndpoint { get; }`; storage holds `Guid SystemEndpoint`; mapper resolves the parent via the parent's repository in `Map(stored, ct)`. Configure with `HasOne<ModelEndpointEntity>().WithMany().HasForeignKey(e => e.SystemEndpoint).OnDelete(DeleteBehavior.Restrict)`.
- **N:M** — domain holds `IReadOnlyCollection<IEvaluator> Evaluators { get; }`; storage uses a junction entity (e.g. `TestSuiteEvaluatorEntity` with `TestSuiteId`/`EvaluatorId`) and a navigation collection on the parent storage entity. Junction entities have **no domain counterpart** and are registered explicitly in `Proxytrace.Storage.Module`. The custom repository overrides `UpdateRelationsAsync` to sync the junction rows during `Update` (see `TestSuiteRepository`).
- **Delete behavior** — `Restrict` for optional references, `Cascade` for owned children.

## Testing Conventions

**Before writing or modifying any backend test, you MUST invoke the `test` skill
(`.claude/skills/test/SKILL.md`) and follow it.** It is the source of truth for the test
harness: per-test `BaseTest<TModule>` containers, the `ConfigureContainer` / `GetServices`
DI hooks, NSubstitute substitution patterns, and the hard rules against shared
state/fields and `[TestFixture]`-style helper classes. The summary below is orientation
only; the skill overrides it where they differ.

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
- Domain references hold the related entity (e.g. `IModelEndpoint`, `IReadOnlyCollection<IEvaluator>`); storage entities hold the `Guid` foreign key
- Storage entities use `required` properties with `init` accessors and extend `Entity`
- Decorate custom storage repositories with `[UsedImplicitly]` so reflection-based DI discovers them

## Database Configuration

Storage is **PostgreSQL only** for persistent runs (debug/release/e2e) and **in-memory** for unit tests and kiosk mode. SQLite and SQL Server have been removed.

| Mode | Selected when | Schema init |
|------|---------------|-------------|
| PostgreSQL | non-kiosk (connection string from `Proxytrace.Api/appsettings.json`) | EF migrations (`MigrateAsync`) on startup |
| In-memory | `Kiosk:Enabled=true`, and all unit tests | `EnsureCreatedAsync` (no migrations) |

Migrations are PostgreSQL-typed (`uuid`/`boolean`/`timestamptz`). The design-time factory always targets PostgreSQL using `ConnectionStrings:Default`; regenerate with `ConnectionStrings__Default=Host=...` set. Transactions use a single shared EF `IDbContextTransaction` per logical unit (`AmbientDbContext` + `Transaction`), so writes never promote to a 2-phase transaction. See `DATABASE.md` for full details.

## Domain Concepts

The domain (`Proxytrace.Domain/`) currently models:

- **User, Project** — Tenancy. `Project` references one `IModelEndpoint` (`SystemEndpoint`) used by built-in system agents (e.g. agent-name generation, optimizers).
- **Agent** — An AI agent: `Name`, `SystemPrompt` (`IPromptTemplate`), `Tools` (`IReadOnlyList<ToolSpecification>`), `Endpoint` (`IModelEndpoint`), `Project`, `IsSystemAgent` flag.
- **AgentCall** — A captured LLM interaction (one trace entry).
- **ModelProvider, Model, ModelEndpoint** — `ModelProvider` is the upstream API (OpenAI, Anthropic, …). `ModelEndpoint` pairs a `Model` with a `ModelProvider` and stores per-token costs (`InputTokenCost`, `OutputTokenCost`); has `CalculateCost(TokenUsage)`.
- **ApiKey** — Proxytrace-issued key for clients hitting the OpenAI proxy. Tied to a `Project` + `ModelProvider`.
- **TestSuite, TestCase** — Curated benchmark inputs. `TestSuite` has N:M with `IEvaluator` (junction `TestSuiteEvaluatorEntity`).
- **TestRun, TestRunGroup, TestResult** — Execution records of a suite against an agent.
- **Evaluator** (base) + concrete subtypes (`IExactMatchEvaluator`, `INumericMatchEvaluator`, `IJsonSchemaMatchEvaluator`, `IToolUsageEvaluator`, `IHelpfulnessEvaluator`, `ISafetyClassifier`, `IPolitenessEvaluator`, `ICustomEvaluator`, plus the LLM-based `IAgenticEvaluator` group). Each `EvaluateAsync(ITestResult)` returns an `IEvaluation` (domain object).
- **OptimizationProposal** — Suggestion to improve an agent: `Kind`, `Status` (Review/Approved/Rejected), `Priority`, `Rationale`, typed `ProposalDetails` (e.g. `SwitchModelProposal`, `UpdateSystemPromptProposal`), `EvidenceTestRunIds`.
- **Domain objects (no storage):** `IPromptTemplate`, `IPrompt`, `Message` + role-specific subtypes (`SystemMessage`, `UserMessage`, `AssistantMessage`, `ToolMessage`), `Conversation`, `ToolSpecification`/`ToolArguments`/`ToolRequest`/`ToolResponse`, `TokenUsage`, `ICompletion`, `IEvaluation`.

## Frontend Architecture

React 19 with Vite, TypeScript, TanStack Query v5, and React Router 7. Code lives in `frontend/`. Layout:

- `src/api/` — typed fetch services (`agents.ts`, `agent-calls.ts`, `providers.ts`, `evaluators.ts`, `proposals.ts`, `setup.ts`, `statistics.ts`, `test-runs.ts`, `test-run-groups.ts`, `test-suites.ts`, `health.ts`), shared `models.ts`, base `client.ts` wrapper, `query-keys.ts` factory, and SSE hooks in `event-stream.ts`
- `src/components/layout/` — top-level chrome (`Shell.tsx`, `NavItem.tsx`)
- `src/components/overlays/` — `Modal.tsx`, `Drawer.tsx`, `ConfirmDialog.tsx`, `StepWizard.tsx`
- `src/components/ui/` — shared primitives: `KpiCard`, `Pill`, `Pagination`, `FilterTabs`, `EmptyState`, `CodeBlock`, `StatusDot`, `ProgressBar`, `Toast`
- `src/features/` — one folder per route: `dashboard`, `traces`, `agents`, `suites`, `evaluators`, `runs`, `providers`, `proposals`, `setup`. Each is a lazy-loaded page component via `React.lazy()` in `App.tsx`
- `src/lib/` — pure utilities: `format.ts` (number/date formatters), `colors.ts` (model/status color maps), `charts.ts` (SVG path math), `constants.ts`
- `src/hooks/` — custom React hooks
- Tailwind CSS 4 via `@tailwindcss/vite`; use Tailwind utility classes for all static styles. Inline `style={{}}` is only acceptable for genuinely dynamic values (e.g. runtime-computed colors, percentage widths from data, a numeric `borderRadius` prop). Complex static values — gradients, shadows, CSS-variable references — must use Tailwind's arbitrary-value syntax: `bg-[linear-gradient(...)]`, `shadow-[var(--shadow-card)]`, `shadow-[0_4px_16px_...]`, etc.
- Tests use Vitest (`*.spec.ts`)

Backend endpoints are proxied through Vite when running `./dev.sh` (`/api` → backend 5001). Frontend runs on port 4201. Real-time updates (new traces, test results, proposals) flow through SSE broadcasters defined in `Proxytrace.Application` and consumed via `event-stream.ts`.

### Commands
- `npm run build` -– build the frontend, use this to verify there are no typing issues (output in `dist/`)
- `npm run lint` -– run ESLint with auto-fix, use this frequently during development

## Reference Implementations

When implementing a new entity, the existing ones are the source of truth:
- **No relationships:** `User`
- **1:N relationship:** `Project` references one `IModelEndpoint` (`SystemEndpoint`)
- **N:M relationship:** `TestSuite` holds `IReadOnlyCollection<IEvaluator>`, junction is `TestSuiteEvaluatorEntity`, custom `TestSuiteRepository` overrides `UpdateRelationsAsync`
