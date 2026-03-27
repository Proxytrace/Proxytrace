# Skill: Creating a New Domain Entity with Storage

This guide provides a step-by-step process for implementing new domain entities in the Trsr codebase, following the established architecture patterns.

## Prerequisites

- Understand the entity's properties and relationships
- Determine validation rules
- Identify foreign key relationships (1:1, 1:N, N:M)

## Step 1: Create Domain Interface and Data Interface

**Location:** `Trsr.Domain/[EntityName]/`

### 1.1 Create `I[EntityName]Data.cs`
```csharp
namespace Trsr.Domain.[EntityName];

public interface I[EntityName]Data : IDomainEntityData
{
    // Add entity-specific properties
    public string PropertyName { get; }
    public Guid ForeignKeyId { get; }
    public IReadOnlyCollection<Guid> RelatedIds { get; }
}
```

### 1.2 Create `I[EntityName].cs`
```csharp
namespace Trsr.Domain.[EntityName];

public interface I[EntityName] : IDomainEntity, I[EntityName]Data
{
    // Factory delegates for creating instances
    public delegate I[EntityName] CreateNew(string prop1, Guid prop2);
    public delegate I[EntityName] CreateExisting(I[EntityName]Data existing);
}
```

**Key Points:**
- `I[EntityName]Data` extends `IDomainEntityData` (provides Id, CreatedAt, UpdatedAt)
- `I[EntityName]` extends both `IDomainEntity` and `I[EntityName]Data`
- Define two delegates: `CreateNew` for new instances, `CreateExisting` for persistence mapping
- Use `IReadOnlyCollection<Guid>` for foreign key collections, not navigation properties

## Step 2: Implement Internal Domain Entity

**Location:** `Trsr.Domain/[EntityName]/Internal/`

### 2.1 Create `[EntityName].cs`
```csharp
using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;

namespace Trsr.Domain.[EntityName].Internal;

internal record [EntityName] : DomainEntity, I[EntityName]
{
    public string PropertyName { get; }
    public Guid ForeignKeyId { get; }
    public IReadOnlyCollection<Guid> RelatedIds { get; }

    // Constructor for NEW entities
    public [EntityName](string propertyName, Guid foreignKeyId)
    {
        PropertyName = propertyName;
        ForeignKeyId = foreignKeyId;
        RelatedIds = Array.Empty<Guid>();
    }

    // Constructor for EXISTING entities (from storage)
    public [EntityName](I[EntityName]Data existing) : base(existing)
    {
        PropertyName = existing.PropertyName;
        ForeignKeyId = existing.ForeignKeyId;
        RelatedIds = existing.RelatedIds;
    }

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        // Call base validation
        foreach (var result in base.Validate(validationContext))
        {
            yield return result;
        }
        
        // Add entity-specific validation
        if (string.IsNullOrWhiteSpace(PropertyName))
        {
            yield return Validation.NotNullOrWhitespace(PropertyName, nameof(PropertyName));
        }
        
        if (ForeignKeyId == Guid.Empty)
        {
            yield return Validation.NotDefault(ForeignKeyId, nameof(ForeignKeyId));
        }
    }
}
```

**Key Points:**
- Extend `DomainEntity` base class
- Implement `I[EntityName]` interface
- Two constructors: parameterless/parametered for new, data interface for existing
- Call `base(existing)` for existing entities to populate Id, CreatedAt, UpdatedAt
- Override `Validate()` and call base validation first
- All properties are immutable (init-only or get-only)

## Step 3: Create Domain Entity Generator

**Location:** `Trsr.Domain/[EntityName]/Internal/`

### 3.1 Create `[EntityName]Generator.cs`
```csharp
using Trsr.Common.Async;
using Trsr.Domain.Internal;

namespace Trsr.Domain.[EntityName].Internal;

internal class [EntityName]Generator : DomainEntityGenerator<I[EntityName]>
{
    private readonly I[EntityName].CreateNew factory;

    public [EntityName]Generator(
        I[EntityName].CreateNew factory,
        IRepository<I[EntityName]> repository) : base(repository)
    {
        this.factory = factory;
    }

    public override Task<I[EntityName]> GenerateAsync(CancellationToken cancellationToken = default) 
        => factory(
            Guid.NewGuid().ToString(), // Generate test data
            Guid.NewGuid()
        ).ToTaskResult();
}
```

**Key Points:**
- Extend `DomainEntityGenerator<I[EntityName]>`
- Inject `CreateNew` delegate and repository
- `GenerateAsync()` creates test data for unit tests
- Auto-registered by `Trsr.Domain.Module`

## Step 4: Create Storage Entity

**Location:** `Trsr.Storage/Internal/Entities/[EntityName]/`

### 4.1 Create `[EntityName]Entity.cs`
```csharp
using Trsr.Domain.[EntityName];

namespace Trsr.Storage.Internal.Entities.[EntityName];

[StoredDomainEntity(typeof(I[EntityName]))]
internal record [EntityName]Entity : Entity, I[EntityName]
{
    /// <summary>
    /// <see cref="I[EntityName].PropertyName"/>
    /// </summary>
    public required string PropertyName { get; init; }
    
    /// <summary>
    /// <see cref="I[EntityName].ForeignKeyId"/>
    /// </summary>
    public required Guid ForeignKeyId { get; set; }
    
    // For N:M relationships, add navigation properties
    public ICollection<RelatedEntity> RelatedEntities { get; init; } = new List<RelatedEntity>();
    
    // Computed property from navigation
    public IReadOnlyCollection<Guid> RelatedIds => RelatedEntities.Select(r => r.Id).ToList();
}
```

**Key Points:**
- Extend `Entity` base class
- Implement `I[EntityName]` interface
- Decorate with `[StoredDomainEntity(typeof(I[EntityName]))]`
- Use `required` for properties that must be set
- For N:M relationships: navigation property + computed property pattern
- Add XML doc comments referencing domain interface

## Step 5: Create EF Core Configuration and Mapper

**Location:** `Trsr.Storage/Internal/Entities/[EntityName]/`

### 5.1 Create `[EntityName]Config.cs`

#### Simple Entity (No Complex Relationships)
```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Domain.[EntityName];

namespace Trsr.Storage.Internal.Entities.[EntityName];

/// <summary>
/// Entity Framework configuration for <see cref="[EntityName]Entity"/>
/// </summary>
internal class [EntityName]Config : AbstractEntityConfiguration<[EntityName]Entity>, IMapper<I[EntityName], [EntityName]Entity>
{
    private readonly I[EntityName].CreateExisting factory;

    public [EntityName]Config(I[EntityName].CreateExisting factory)
    {
        this.factory = factory;
    }
    
    /// <inheritdoc />
    public override void Configure(EntityTypeBuilder<[EntityName]Entity> builder)
    {
        // Unique constraints
        builder
            .HasIndex(e => new { e.PropertyName, e.ForeignKeyId })
            .IsUnique();
        
        // Foreign key relationships (1:N)
        builder
            .HasOne<RelatedEntity>()
            .WithMany()
            .HasForeignKey(e => e.ForeignKeyId)
            .OnDelete(DeleteBehavior.Restrict); // or Cascade
    }

    public I[EntityName] Map([EntityName]Entity storedEntity)
        => factory(storedEntity);

    public [EntityName]Entity Map(I[EntityName] domainEntity)
        => new()
        {
            Id = domainEntity.Id,
            PropertyName = domainEntity.PropertyName,
            ForeignKeyId = domainEntity.ForeignKeyId,
            CreatedAt = domainEntity.CreatedAt,
            UpdatedAt = domainEntity.UpdatedAt,
        };
}
```

#### Entity with N:M Relationship
```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trsr.Domain.[EntityName];

namespace Trsr.Storage.Internal.Entities.[EntityName];

internal class [EntityName]Config : AbstractEntityConfiguration<[EntityName]Entity>, IMapper<I[EntityName], [EntityName]Entity>
{
    private readonly I[EntityName].CreateExisting factory;

    public [EntityName]Config(I[EntityName].CreateExisting factory)
    {
        this.factory = factory;
    }
    
    public override void Configure(EntityTypeBuilder<[EntityName]Entity> builder)
    {
        builder
            .HasIndex(e => new { e.PropertyName })
            .IsUnique();
        
        // Configure N:M relationship with junction table
        builder
            .HasMany(e => e.RelatedEntities)
            .WithMany()
            .UsingEntity<[EntityName]RelatedEntity>(
                "[EntityName]Related",
                j => j
                    .HasOne<RelatedEntity>()
                    .WithMany()
                    .HasForeignKey(x => x.RelatedId)
                    .OnDelete(DeleteBehavior.Restrict),
                j => j
                    .HasOne<[EntityName]Entity>()
                    .WithMany()
                    .HasForeignKey(x => x.[EntityName]Id)
                    .OnDelete(DeleteBehavior.Cascade),
                j =>
                {
                    j.HasKey(x => new { x.[EntityName]Id, x.RelatedId });
                });
        
        // Ignore computed property
        builder.Ignore(e => e.RelatedIds);
    }

    public I[EntityName] Map([EntityName]Entity storedEntity)
        => factory(storedEntity);

    public [EntityName]Entity Map(I[EntityName] domainEntity)
    {
        return new [EntityName]Entity
        {
            Id = domainEntity.Id,
            PropertyName = domainEntity.PropertyName,
            CreatedAt = domainEntity.CreatedAt,
            UpdatedAt = domainEntity.UpdatedAt,
        };
        // Note: Navigation properties handled in repository
    }
}
```

**Key Points:**
- Extend `AbstractEntityConfiguration<[EntityName]Entity>`
- Implement `IMapper<I[EntityName], [EntityName]Entity>`
- Inject `CreateExisting` factory delegate
- Configure indexes, foreign keys, and relationships in `Configure()`
- Use `DeleteBehavior.Restrict` for optional relationships, `Cascade` for owned
- For N:M relationships, ignore computed properties
- Auto-registered by `Trsr.Storage.Module`

## Step 6: Create Junction Table Entity (N:M Only)

**Location:** `Trsr.Storage/Internal/Entities/[EntityName]/`

### 6.1 Create `[EntityName]RelatedEntity.cs`
```csharp
namespace Trsr.Storage.Internal.Entities.[EntityName];

/// <summary>
/// Junction table for N:M relationship between [EntityName] and Related
/// </summary>
internal record [EntityName]RelatedEntity
{
    public required Guid [EntityName]Id { get; init; }
    public required Guid RelatedId { get; init; }
}
```

## Step 7: Create Custom Repository (Optional - N:M or Complex Queries)

**Location:** `Trsr.Storage/Internal/Entities/[EntityName]/`

### 7.1 Create `[EntityName]Repository.cs`
```csharp
using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Trsr.Domain;
using Trsr.Domain.[EntityName];

namespace Trsr.Storage.Internal.Entities.[EntityName];

/// <summary>
/// Repository for [EntityName] entities
/// </summary>
[UsedImplicitly]
internal class [EntityName]Repository : AbstractRepository<I[EntityName], [EntityName]Entity>
{
    public [EntityName]Repository(
        IMapper<I[EntityName], [EntityName]Entity> mapper,
        Func<StorageDbContext> context,
        ITransaction transaction) : base(
        mapper,
        context,
        transaction)
    {
    }

    // Override methods that need to Include() navigation properties
    
    // Custom query methods
    public async Task<I[EntityName]?> FindByPropertyAsync(
        string propertyValue,
        CancellationToken cancellationToken = default)
    {
        var entity = await contextFactory()
            .Set<[EntityName]Entity>()
            .Include(e => e.RelatedEntities)
            .FirstOrDefaultAsync(e => e.PropertyName == propertyValue, cancellationToken);
        
        return Map(entity);
    }
}
```

**Key Points:**
- Only create if you need custom queries or N:M relationship handling
- Extend `AbstractRepository<I[EntityName], [EntityName]Entity>`
- Use `Include()` to load navigation properties
- Decorate with `[UsedImplicitly]` for Autofac auto-registration

## Step 8: Handle N:M Relationships in Repository

For N:M relationships, you need to override Add/Update methods to manage the junction table:

```csharp
protected override async Task<I[EntityName]> AddAsync(
    StorageDbContext context, 
    I[EntityName] entity,
    CancellationToken cancellationToken = default)
{
    return await transaction.InvokeAsync(async () =>
    {
        // Validate
        Validator.ValidateObject(entity, new ValidationContext(entity), true);

        // Check if exists
        bool exists = await context.Set<[EntityName]Entity>()
            .AnyAsync(e => e.Id == entity.Id, cancellationToken);
        if (exists)
        {
            throw new EntityAlreadyExistsException(entity.Id, typeof(I[EntityName]));
        }

        // Map to storage entity
        var stored = Map(entity);
        
        // Load related entities from database
        if (entity.RelatedIds.Any())
        {
            var relatedIds = entity.RelatedIds.ToList();
            var related = await context.Set<RelatedEntity>()
                .Where(r => relatedIds.Contains(r.Id))
                .ToListAsync(cancellationToken);
            
            stored.RelatedEntities.Clear();
            foreach (var r in related)
            {
                stored.RelatedEntities.Add(r);
            }
        }

        // Add and save
        context.Set<[EntityName]Entity>().Add(stored);
        await context.SaveChangesAsync(cancellationToken);
        
        return Map(stored);
    }, cancellationToken);
}
```

## Validation Patterns

Common validation helpers from `Trsr.Common.Validation`:

```csharp
// Not null or whitespace
yield return Validation.NotNullOrWhitespace(PropertyName, nameof(PropertyName));

// Not default (Guid.Empty, 0, etc.)
yield return Validation.NotDefault(Id, nameof(Id));

// Date in past
yield return Validation.InPast(CreatedAt, nameof(CreatedAt));

// Date not before another
yield return Validation.NotBefore(UpdatedAt, CreatedAt, nameof(UpdatedAt));
```

## Foreign Key Relationships Summary

### One-to-Many (1:N)
- **Domain:** Store foreign key as `Guid` property
- **Storage:** Configure with `HasOne<>().WithMany().HasForeignKey()`
- **Delete Behavior:** `Restrict` (prevent cascade) or `Cascade` (delete children)

### Many-to-Many (N:M)
- **Domain:** Store collection as `IReadOnlyCollection<Guid>`
- **Storage:** 
  - Navigation property `ICollection<RelatedEntity>`
  - Computed property for domain interface
  - Junction entity with composite key
  - Configure with `HasMany().WithMany().UsingEntity<>()`
  - Ignore computed property
- **Repository:** Override Add/Update to manage junction table

## Auto-Registration

Both `Trsr.Domain.Module` and `Trsr.Storage.Module` use reflection-based auto-registration:

- **Domain:** Classes implementing `IDomainEntity` in `*/Internal/` folders
- **Storage:** Classes with `[StoredDomainEntity]` attribute
- **Repositories:** Classes extending `AbstractRepository<,>` with `[UsedImplicitly]`
- **Mappers:** Classes implementing `IMapper<,>`
- **Configurations:** Classes implementing `IModelConfiguration`

**No manual registration needed!**

## Testing

Tests automatically discover entities via `EntityTestCases`:

```csharp
[DataTestMethod]
[DynamicData(nameof(GetTestCases), DynamicDataSourceType.Method)]
public async Task Repository_AddAsync_AddsEntity(Type storedEntityType)
{
    // Tests run automatically for all entities
}
```

## Checklist

Use this checklist when creating a new entity:

- [ ] Domain interface files created (`I[EntityName].cs`, `I[EntityName]Data.cs`)
- [ ] Internal domain entity created (`[EntityName].cs`)
- [ ] Entity generator created (`[EntityName]Generator.cs`)
- [ ] Validation logic implemented
- [ ] Storage entity created (`[EntityName]Entity.cs`)
- [ ] EF Core configuration created (`[EntityName]Config.cs`)
- [ ] Mapper implemented in config class
- [ ] Foreign keys configured with appropriate delete behavior
- [ ] N:M junction table created (if needed)
- [ ] Custom repository created (if needed)
- [ ] N:M relationship handlers in repository (if needed)
- [ ] Solution builds successfully
- [ ] All tests pass

## Common Pitfalls

1. **Forgetting `[StoredDomainEntity]` attribute** - Entity won't be registered
2. **Not calling `base.Validate()`** - Base validation won't run
3. **Using navigation properties in domain interfaces** - Use Guid collections instead
4. **Not ignoring computed properties** - EF Core will try to map them
5. **Forgetting to Include() navigation properties** - Will be null when loaded
6. **Wrong delete behavior** - Cascade deletes may not be desired
7. **Not handling N:M in repository** - Junction table won't be populated

## Example: Full Entity Implementation

See existing implementations for reference:
- **Simple entity:** `User` (no complex relationships)
- **1:N relationship:** `Project` → `Organization`
- **N:M relationship:** `Organization` ↔ `User`

