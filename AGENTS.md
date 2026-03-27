# Trsr Codebase Guide for AI Agents

## Architecture Overview

This is a **layered C# .NET 10 architecture** with strict dependency flow and convention-over-configuration:

- **Trsr.Common**: Shared utilities (validation, DI extensions, type conversion)
- **Trsr.Domain**: Business entities and interfaces using interface-based design
- **Trsr.Storage**: EF Core persistence layer with automatic registration
- **Trsr.Testing**: Base test infrastructure using Autofac and MSTest

**Key Principle**: Domain entities are immutable records with dual implementations - domain objects in `Trsr.Domain/Internal` and storage entities in `Trsr.Storage/Internal/Entities`.

## Core Patterns

### Domain Entity Pattern (Interface-Based Design)

Every domain entity requires THREE artifacts:

1. **Public interface** (e.g., `IUser : IDomainEntity, IUserData`)
2. **Internal implementation** in `Trsr.Domain/[Entity]/Internal/[Entity].cs` (e.g., `User : DomainEntity, IUser`)
3. **Storage entity** in `Trsr.Storage/Internal/Entities/[Entity]/[Entity]Entity.cs` decorated with `[StoredDomainEntity(typeof(IUser))]`

Domain interfaces define factory delegates for object creation:
```csharp
public delegate IUser CreateNew(string name);
public delegate IUser CreateExisting(IUserData existing);
```

### Autofac Auto-Registration

Both `Trsr.Domain.Module` and `Trsr.Storage.Module` use **reflection-based discovery**:
- Domain entities implementing `IDomainEntity` are auto-registered with their generators
- Storage entities with `[StoredDomainEntity]` attribute get repositories and mappers auto-wired
- Configurations implement `AbstractEntityConfiguration<TEntity>` and `IMapper<TDomainEntity, TStoredEntity>`

### Repository & Mapper Pattern

Each storage entity needs:
- `[Entity]Entity.cs` - record with `required` properties
- `[Entity]Config.cs` - extends `AbstractEntityConfiguration<T>`, implements `IMapper<TDomain, TStored>`, and defines EF Core configuration
- `[Entity]Repository.cs` (optional) - extends `AbstractRepository<TDomain, TStored>` for custom queries

Example from `UserConfig.cs`:
```csharp
internal class UserConfig : AbstractEntityConfiguration<UserEntity>, IMapper<IUser, UserEntity>
{
    private readonly IUser.CreateExisting factory;
    
    public override void Configure(EntityTypeBuilder<UserEntity> builder)
    {
        builder.HasIndex(e => new{ e.Name }).IsUnique();
    }
}
```

## Validation

All domain objects implement `IValidatableObject`. Validation happens:
1. At domain object creation (enforced by `Module.cs` OnActivated)
2. Before repository Add/Update operations

Use `Trsr.Common.Validation` helpers: `Validation.NotNullOrWhitespace()`, `Validation.NotDefault()`, `Validation.InPast()`, etc.

## Testing Conventions

Tests extend `BaseTest<Module>` which provides:
- Autofac container setup via `GetServices()`
- Access to `TestContext.CancellationToken` via `CancellationToken` property
- Use `IDomainEntityGenerator<T>` for test data: `CreateAsync()` (persists), `GenerateAsync()` (in-memory only), `GetOrCreateAsync()` (reuse or create)

Storage uses **InMemoryDatabase** by default; each test gets isolated context via `Guid.NewGuid()` database name.

## Adding New Domain Entities

1. Create `I[Entity].cs` and `I[Entity]Data.cs` in `Trsr.Domain/[Entity]/`
2. Implement `[Entity].cs` in `Trsr.Domain/[Entity]/Internal/` extending `DomainEntity`
3. Create `[Entity]Generator.cs` in same Internal folder extending `DomainEntityGenerator<I[Entity]>`
4. Create `[Entity]Entity.cs` in `Trsr.Storage/Internal/Entities/[Entity]/` with `[StoredDomainEntity(typeof(I[Entity]))]`
5. Create `[Entity]Config.cs` implementing `AbstractEntityConfiguration<[Entity]Entity>` and `IMapper<I[Entity], [Entity]Entity>`
6. Auto-registration handles the rest - no manual DI registration needed

## Critical Details

- All timestamps are `DateTimeOffset` (not `DateTime`)
- Domain entities use parameterless constructor for new entities, data constructor for existing
- All domain entities are immutable
- Repositories return domain entities, not storage entities
- Prefer `async` methods and pass `CancellationToken` whenever possible
- Use dependency injection
- SOLID principles apply - single responsibility, open/closed, etc.
