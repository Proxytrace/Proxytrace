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

### BaseTest<TModule> Pattern

All test classes extend `BaseTest<TModule>` which provides core testing infrastructure:

```csharp
[TestClass]
public class MyTests : BaseTest<Module>
{
    [TestMethod]
    public async Task MyTest()
    {
        // Use GetServices() to get a configured IServiceProvider
        IServiceProvider services = GetServices();
        
        // Use CancellationToken property for async operations
        var result = await SomeOperationAsync(CancellationToken);
    }
}
```

**Key Features**:
- `GetServices(Action<ContainerBuilder>? action = null)` - Creates isolated Autofac container with registered modules
- `CancellationToken` property - Accesses `TestContext.CancellationToken` for async operations
- `ConfigureContainer(ContainerBuilder builder)` - Override to customize container setup
- Each test gets independent service provider and in-memory database (via `Guid.NewGuid()` database name)

**Required Property**:
```csharp
public required TestContext TestContext { get; init; }
```

### Test Data Generation

Use `IDomainEntityGenerator<T>` for creating test data:

- `CreateAsync(CancellationToken)` - Generates and persists entity to database
- `GenerateAsync(CancellationToken)` - Generates in-memory entity without persistence
- `GetOrCreateAsync(CancellationToken)` - Reuses existing or creates new entity

Example:
```csharp
IServiceProvider services = GetServices();
var generator = services.GetRequiredService<IDomainEntityGenerator<IUser>>();

// Persist to database
IUser persisted = await generator.CreateAsync(CancellationToken);

// In-memory only
IUser inMemory = await generator.GenerateAsync(CancellationToken);
```

### AwesomeAssertions (Fluent Assertions)

Use **AwesomeAssertions** library for all assertions with fluent syntax:

**Basic Assertions**:
```csharp
using AwesomeAssertions;

result.Should().NotBeNull();
result.Should().Be(expected);
result.Should().NotBe(unexpected);
guid.Should().NotBe(Guid.Empty);
text.Should().NotBeNullOrWhiteSpace();
```

**Numeric Assertions**:
```csharp
value.Should().BeGreaterThan(10);
value.Should().BeLessThan(100);
value.Should().BeGreaterThanOrEqualTo(0);
value.Should().BeLessThanOrEqualTo(100);
```

**Collection Assertions**:
```csharp
list.Should().NotBeEmpty();
list.Should().Contain(item);
list.Should().AllSatisfy(x => x.Should().BeGreaterThan(0));
results.Count.Should().Be(5);
```

**Object Equivalence**:
```csharp
// Compares all properties recursively
actualObject.Should().BeEquivalentTo(expectedObject);
```

**Exception Assertions** (Async):
```csharp
// For async methods that throw exceptions
await FluentActions
    .Invoking(() => repository.UpdateAsync(entity, CancellationToken))
    .Should()
    .ThrowAsync<EntityNotFoundException>();
    
await FluentActions
    .Invoking(() => service.PerformOperationAsync())
    .Should()
    .ThrowAsync<OptimisticConcurrencyException>();
```

**Exception Assertions** (Sync):
```csharp
// Use MSTest Assert for synchronous exceptions
var exception = await Assert.ThrowsAsync<EntityNotFoundException>(
    () => repository.GetAsync(nonExistentId));
exception.Should().NotBeNull();
```

### Test Structure Best Practices

Follow **Arrange-Act-Assert** pattern:
```csharp
[TestMethod]
public async Task Repository_GetAsync_ReturnsAddedEntity()
{
    // Arrange - Set up test data and dependencies
    IServiceProvider services = GetServices();
    var repo = services.GetRequiredService<IRepository<IUser>>();
    IUser entity = await services.GetRequiredService<IDomainEntityGenerator<IUser>>()
        .CreateAsync(CancellationToken);
    
    // Act - Perform the operation being tested
    IUser retrieved = await repo.GetAsync(entity.Id, CancellationToken);
    
    // Assert - Verify the expected outcome
    retrieved.Should().NotBeNull();
    retrieved.Id.Should().Be(entity.Id);
}
```

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
