using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata;
using Trsr.Common.Async;
using Trsr.Domain;
using Trsr.Domain.Exceptions;
using Trsr.Storage.Internal.Entities;

namespace Trsr.Storage.Internal;

internal abstract class AbstractRepository<TDomainEntity, TStoredEntity> : IRepository<TDomainEntity>
    where TDomainEntity : class, IDomainEntity
    where TStoredEntity : class, IEntity
{
    protected readonly Func<StorageDbContext> contextFactory;
    private readonly ITransaction transaction;
    protected readonly IMapper<TDomainEntity, TStoredEntity> mapper;
    private readonly IEntityCache<TDomainEntity>? cache;

    protected AbstractRepository(
        IMapper<TDomainEntity, TStoredEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction,
        IEntityCache<TDomainEntity>? cache = null)
    {
        this.mapper = mapper;
        this.contextFactory = contextFactory;
        this.transaction = transaction;
        this.cache = cache;
    }

    // The cache must never be read from or populated while an ambient transaction is active:
    // values read inside a transaction can reflect uncommitted writes, and populating from a
    // transaction that later rolls back would leave phantom data in the cache. Invalidation is
    // always safe and is performed unconditionally on writes.
    private bool CanUseCache 
        => cache is not null && System.Transactions.Transaction.Current is null;

    /// <inheritdoc />
    public async Task<TDomainEntity?> FindAsync(Guid id, CancellationToken cancellationToken = default)
    {
        if (CanUseCache)
        {
            TDomainEntity? cached = cache?.TryGet(id);
            if (cached is not null)
            {
                return cached;
            }
        }

        TStoredEntity? stored = await FindAsync(contextFactory(), id, cancellationToken);
        if (stored is null)
        {
            return null;
        }

        TDomainEntity domain = await mapper.Map(stored, cancellationToken);
        if (CanUseCache)
        {
            cache?.Set(domain);
        }
        return domain;
    }
    
    /// <summary>
    /// Finds the stored entity by its id
    /// Returns null if not found
    /// </summary>
    private ValueTask<TStoredEntity?> FindAsync(StorageDbContext context, Guid id, CancellationToken cancellationToken = default)
        => context.Set<TStoredEntity>().FindAsync([id], cancellationToken);

    /// <inheritdoc />
    public Task<bool> ContainsAsync(Guid id, CancellationToken cancellationToken = default)
        => Contains(id, contextFactory(), cancellationToken);
    
    private async Task<bool> Contains(Guid id, DbContext context, CancellationToken cancellationToken = default)
        => await context
            .Set<TStoredEntity>()
            .AsNoTracking()
            .AnyAsync(e => e.Id == id, cancellationToken);

    /// <inheritdoc />
    public async Task<int> CountAsync(CancellationToken cancellationToken = default)
        => await contextFactory()
            .Set<TStoredEntity>()
            .AsNoTracking()
            .CountAsync(cancellationToken);

    /// <inheritdoc />
    public async Task<IReadOnlyList<TDomainEntity>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        if (CanUseCache && cache?.TryGetAll() is { } snapshot)
        {
            return snapshot;
        }

        var stored = await contextFactory()
            .Set<TStoredEntity>()
            .AsNoTracking()
            .ToListAsync(cancellationToken);
        IReadOnlyList<TDomainEntity> mapped = await Map(stored, cancellationToken);

        if (CanUseCache)
        {
            cache?.SetAll(mapped);
        }
        return mapped;
    }

    public async Task<IReadOnlyList<TDomainEntity>> GetManyAsync(IReadOnlyCollection<Guid> primaryKeys, CancellationToken cancellationToken = default)
    {
        primaryKeys = primaryKeys.Distinct().ToArray();

        if (CanUseCache)
        {
            var hits = new List<TDomainEntity>(primaryKeys.Count);
            var misses = new List<Guid>();
            foreach (Guid id in primaryKeys)
            {
                TDomainEntity? cached = cache?.TryGet(id);
                if (cached is not null)
                {
                    hits.Add(cached);
                }
                else
                {
                    misses.Add(id);
                }
            }

            if (misses.Count == 0)
            {
                return hits;
            }

            List<TStoredEntity> missingStored = await contextFactory()
                .Set<TStoredEntity>()
                .AsNoTracking()
                .Where(e => misses.Contains(e.Id))
                .ToListAsync(cancellationToken);

            if (missingStored.Count != misses.Count)
            {
                throw new EntitiesNotFoundException(
                    ids: misses.Except(missingStored.Select(e => e.Id)).ToArray(),
                    entityType: typeof(TDomainEntity));
            }

            IReadOnlyList<TDomainEntity> missingMapped = await Map(missingStored, cancellationToken);
            foreach (TDomainEntity entity in missingMapped)
            {
                cache?.Set(entity);
            }

            hits.AddRange(missingMapped);
            return hits;
        }

        List<TStoredEntity> stored = await contextFactory()
            .Set<TStoredEntity>()
            .AsNoTracking()
            .Where(e => primaryKeys.Contains(e.Id))
            .ToListAsync(cancellationToken);

        if (stored.Count != primaryKeys.Count)
        {
            throw new EntitiesNotFoundException(
                ids: primaryKeys.Except(stored.Select(e => e.Id)).ToArray(),
                entityType: typeof(TDomainEntity));
        }

        return await Map(stored, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<TDomainEntity?> FindFirstAsync(CancellationToken cancellationToken = default)
    {
        TStoredEntity? result = await contextFactory()
            .Set<TStoredEntity>()
            .AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);
        return await Map(result, cancellationToken);
    }

    /// <inheritdoc />
    public Task<TDomainEntity> AddAsync(TDomainEntity entity, CancellationToken cancellationToken = default)
        => AddAsync(contextFactory(), entity, cancellationToken);

    private Task<TDomainEntity> AddAsync(
        StorageDbContext context,
        TDomainEntity entity,
        CancellationToken cancellationToken = default)
        => transaction.InvokeAsync(async () =>
        {
            Validator.ValidateObject(entity, new ValidationContext(entity), validateAllProperties: true);

            bool exists = await Contains(entity.Id, context, cancellationToken);
            if (exists)
            {
                throw new EntityAlreadyExistsException(entity.Id, typeof(TDomainEntity));
            }

            TStoredEntity stored = await mapper.Map(entity, cancellationToken);
            EntityEntry<TStoredEntity> entry = context.Set<TStoredEntity>().Add(stored);
            await context.SaveChangesAsync(cancellationToken);
            cache?.Invalidate(entity.Id);
            return await mapper.Map(entry.Entity, cancellationToken);
        });

    /// <inheritdoc />
    public Task<TDomainEntity> UpsertAsync(TDomainEntity entity, CancellationToken cancellationToken = default)
        => transaction.InvokeAsync(async () =>
        {
            Validator.ValidateObject(entity, new ValidationContext(entity), validateAllProperties: true);
            var context = contextFactory();

            // Find the existing entity with tracking enabled
            TStoredEntity? existing = await FindAsync(context, entity.Id, cancellationToken);

            return existing is null
                ? await AddAsync(context, entity, cancellationToken)
                : await UpdateAsync(context, entity, cancellationToken);
        });

    /// <inheritdoc />
    public Task<TDomainEntity> UpdateAsync(TDomainEntity entity, CancellationToken cancellationToken = default)
        => UpdateAsync(contextFactory(), entity, cancellationToken);

    private Task<TDomainEntity> UpdateAsync(
        StorageDbContext context,
        TDomainEntity entity,
        CancellationToken cancellationToken = default)
        => transaction.InvokeAsync(async () =>
        {
            Validator.ValidateObject(entity, new ValidationContext(entity), validateAllProperties: true);

            // Find the existing entity with tracking enabled
            TStoredEntity? existing = await FindAsync(context, entity.Id, cancellationToken);

            if (existing is null)
            {
                throw new EntityNotFoundException(entity.Id, typeof(TDomainEntity));
            }
            
            // check for optimistic concurrency conflict
            if (existing.UpdatedAt != entity.UpdatedAt)
            {
                throw new OptimisticConcurrencyException(entity.Id, typeof(TDomainEntity));
            }

            // Map the updated domain entity to storage entity
            TStoredEntity updated = await mapper.Map(entity, cancellationToken);

            // Update the tracked entity using EF Core's proper update mechanism
            EntityEntry<TStoredEntity> entry = context.Entry(existing);
            entry.CurrentValues.SetValues(updated);

            // Handle owned entities manually
            UpdateOwnedEntities(entry, updated);

            await UpdateRelationsAsync(context, updated, cancellationToken);

            // Save changes
            await context.SaveChangesAsync(cancellationToken);
            cache?.Invalidate(entity.Id);

            return await this.GetAsync(entity.Id, cancellationToken);
        });

    protected virtual Task UpdateRelationsAsync(
        StorageDbContext context, 
        TStoredEntity storedEntity,
        CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public Task<bool> RemoveAsync(Guid id, CancellationToken cancellationToken = default)
        => transaction.InvokeAsync(async () =>
        {
            StorageDbContext context = contextFactory();
            TStoredEntity? existing = await FindAsync(context, id, cancellationToken);
            if (existing is null)
            {
                return false;
            }

            context.Set<TStoredEntity>().Remove(existing);
            await context.SaveChangesAsync(cancellationToken);
            cache?.Invalidate(id);
            return true;
        });

    public Task RemoveAllAsync(CancellationToken cancellationToken = default)
        => transaction.InvokeAsync(() =>
        {
            StorageDbContext context = contextFactory();
            context.Set<TStoredEntity>().RemoveRange(context.Set<TStoredEntity>());
            cache?.InvalidateAll();
            return Task.CompletedTask;
        });

    /// <summary>
    /// Updates owned entities manually since SetValues doesn't handle them properly
    /// </summary>
    private void UpdateOwnedEntities(EntityEntry<TStoredEntity> entry, TStoredEntity updated)
    {
        var entityType = entry.Metadata;

        IEnumerable<INavigation> ownedNavigations = entityType
            .GetNavigations()
            .Where(n => n.ForeignKey.IsOwnership);
        foreach (var navigation in ownedNavigations)
        {
            string ownedProperty = navigation.Name;
            object? updatedOwnedValue = navigation.GetGetter().GetClrValue(updated);

            // Get the owned entity entry
            ReferenceEntry ownedEntry = entry.Reference(ownedProperty);

            if (updatedOwnedValue != null)
            {
                if (ownedEntry.CurrentValue is not null)
                {
                    // Update existing owned entity
                    EntityEntry ownedEntityEntry = ownedEntry.TargetEntry 
                                                    ?? throw new InvalidOperationException($"Owned entity entry for navigation '{ownedProperty}' is null.");
                    ownedEntityEntry.CurrentValues.SetValues(updatedOwnedValue);
                }
                else
                {
                    // Set new owned entity
                    ownedEntry.CurrentValue = updatedOwnedValue;
                }
            }
            else
            {
                // Set to null
                ownedEntry.CurrentValue = null;
            }
        }
    }

    /// <summary>
    /// Maps to the domain entity
    /// </summary>
    protected async Task<TDomainEntity?> Map(TStoredEntity? stored, CancellationToken cancellationToken = default)
        => stored is not null ? await mapper.Map(stored, cancellationToken) : null;
    
    /// <summary>
    /// Maps to the domain entity
    /// </summary>
    protected async Task<IReadOnlyList<TDomainEntity>> Map(IReadOnlyList<TStoredEntity> stored, CancellationToken cancellationToken = default)
        => await stored
            .Select(x => Map(x, cancellationToken)).Await()
            .ContinueWith(t => t.Result.Cast<TDomainEntity>().ToList(), cancellationToken);

    /// <summary>
    /// Maps to the stored entity
    /// </summary>
    protected async Task<TStoredEntity?> Map(TDomainEntity? domain, CancellationToken cancellationToken = default)
        => domain is not null ? await mapper.Map(domain, cancellationToken) : null;
}