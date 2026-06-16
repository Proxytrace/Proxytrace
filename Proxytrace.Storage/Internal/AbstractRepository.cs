using System.ComponentModel.DataAnnotations;
using System.Runtime.CompilerServices;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata;
using Proxytrace.Domain;
using Proxytrace.Domain.Events;
using Proxytrace.Domain.Exceptions;
using Proxytrace.Domain.Paging;
using Proxytrace.Storage.Internal.Entities;

namespace Proxytrace.Storage.Internal;

internal abstract class AbstractRepository<TDomainEntity, TStoredEntity> : IRepository<TDomainEntity>
    where TDomainEntity : class, IDomainEntity
    where TStoredEntity : Entity
{
    protected readonly Func<StorageDbContext> contextFactory;
    protected readonly ITransaction transaction;
    protected readonly IMapper<TDomainEntity, TStoredEntity> mapper;
    protected readonly AmbientDbContext ambient;
    private readonly IEntityCache<TDomainEntity>? cache;
    private readonly IEntityEventService entityEvents;

    protected AbstractRepository(
        IMapper<TDomainEntity, TStoredEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction,
        IEntityEventService entityEvents,
        AmbientDbContext ambient,
        IEntityCache<TDomainEntity>? cache = null)
    {
        this.mapper = mapper;
        this.contextFactory = contextFactory;
        this.transaction = transaction;
        this.entityEvents = entityEvents;
        this.ambient = ambient;
        this.cache = cache;
    }

    protected void Notify(Guid id, EntityChangeType change)
    {
        var changedEvent = new EntityChangedEvent(id, typeof(TDomainEntity), change);

        // Defer the notification until the outermost transaction commits. When a write runs inside a
        // larger logical unit (a nested InvokeAsync that does not commit), firing immediately would
        // tell SSE broadcasters / cache invalidators / adoption tracking about a row that a later
        // step could still roll back. When no transaction is active the action runs immediately.
        ambient.RegisterPostCommit(() => entityEvents.Notify(changedEvent));
    }

    /// <summary>
    /// Invalidate a single cached entity. Use after bypass writes that do not go through
    /// the standard Add/Update path.
    /// </summary>
    protected void InvalidateCacheEntry(Guid id) 
        => cache?.Invalidate(id);

    // The cache must never be read from or populated while an ambient transaction is active:
    // values read inside a transaction can reflect uncommitted writes, and populating from a
    // transaction that later rolls back would leave phantom data in the cache. Invalidation is
    // always safe and is performed unconditionally on writes.
    private bool CanUseCache
        => cache is not null && !ambient.IsActive;

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

    public async IAsyncEnumerable<TDomainEntity> EnumerateAsync([EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        IAsyncEnumerable<TStoredEntity> enumerable =  contextFactory()
            .Set<TStoredEntity>()
            .AsNoTracking()
            .AsAsyncEnumerable();

        await foreach (TStoredEntity stored in enumerable.WithCancellation(cancellationToken))
        {
            TDomainEntity domain = await mapper.Map(stored, cancellationToken);
            if (CanUseCache)
            {
                cache?.Set(domain);
            }
            yield return domain;
        }
    }

    /// <inheritdoc />
    public virtual async Task<IReadOnlyList<TDomainEntity>> GetAllAsync(CancellationToken cancellationToken = default)
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

    /// <summary>
    /// Hook for list queries to exclude rows that should not appear in pickers/listings (e.g.
    /// archived entities). By-key lookups never call this, so history keeps resolving. Default: no
    /// filtering; <see cref="ArchivableRepository{TDomainEntity,TStoredEntity}"/> overrides it.
    /// </summary>
    protected virtual IQueryable<TStoredEntity> FilterListQuery(IQueryable<TStoredEntity> query) => query;

    /// <inheritdoc />
    public async Task<PagedResult<TDomainEntity>> GetPagedAsync(
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        (page, pageSize) = Paging.Clamp(page, pageSize);

        var query = FilterListQuery(contextFactory().Set<TStoredEntity>().AsNoTracking());
        int total = await query.CountAsync(cancellationToken);
        var stored = await query
            .OrderByDescending(e => e.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        IReadOnlyList<TDomainEntity> mapped = await Map(stored, cancellationToken);
        return new PagedResult<TDomainEntity>(mapped, total, page, pageSize);
    }

    public async Task<IReadOnlyList<TDomainEntity>> GetManyAsync(IReadOnlyCollection<Guid> primaryKeys, CancellationToken cancellationToken = default, bool ignoreMissing = false)
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

            if (!ignoreMissing && missingStored.Count != misses.Count)
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

        if (!ignoreMissing && stored.Count != primaryKeys.Count)
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
        // Order by CreatedAt so "first" is deterministic (the oldest/primary row) rather than
        // whatever heap order the database returns; callers treat this as the canonical default.
        TStoredEntity? result = await contextFactory()
            .Set<TStoredEntity>()
            .AsNoTracking()
            .OrderBy(e => e.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
        return await Map(result, cancellationToken);
    }

    /// <inheritdoc />
    public virtual async Task<TDomainEntity> AddAsync(TDomainEntity entity, CancellationToken cancellationToken = default)
    {
        TDomainEntity result = await transaction.InvokeAsync(() => AddCoreAsync(entity, cancellationToken));
        Notify(result.Id, EntityChangeType.Added);
        return result;
    }

    // Runs inside transaction.InvokeAsync, so the ambient transactional context is always active.
    private async Task<TDomainEntity> AddCoreAsync(
        TDomainEntity entity,
        CancellationToken cancellationToken)
    {
        StorageDbContext context = ambient.RequireContext();

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
    }

    /// <inheritdoc />
    public async Task AddRangeAsync(
        IReadOnlyCollection<TDomainEntity> entities,
        CancellationToken cancellationToken = default)
    {
        if (entities.Count == 0)
        {
            return;
        }

        await transaction.InvokeAsync(async () =>
        {
            StorageDbContext context = ambient.RequireContext();

            foreach (TDomainEntity entity in entities)
            {
                Validator.ValidateObject(entity, new ValidationContext(entity), validateAllProperties: true);
            }

            Guid[] ids = entities.Select(e => e.Id).ToArray();
            Guid existingId = await context
                .Set<TStoredEntity>()
                .AsNoTracking()
                .Where(e => ids.Contains(e.Id))
                .Select(e => e.Id)
                .FirstOrDefaultAsync(cancellationToken);
            if (existingId != Guid.Empty)
            {
                throw new EntityAlreadyExistsException(existingId, typeof(TDomainEntity));
            }

            var stored = new List<TStoredEntity>(entities.Count);
            foreach (TDomainEntity entity in entities)
            {
                stored.Add(await mapper.Map(entity, cancellationToken));
            }

            context.Set<TStoredEntity>().AddRange(stored);
            await context.SaveChangesAsync(cancellationToken);
        });

        foreach (TDomainEntity entity in entities)
        {
            cache?.Invalidate(entity.Id);
            Notify(entity.Id, EntityChangeType.Added);
        }
    }

    /// <inheritdoc />
    public virtual async Task<TDomainEntity> UpsertAsync(TDomainEntity entity, CancellationToken cancellationToken = default)
    {
        (TDomainEntity result, EntityChangeType change) = await transaction.InvokeAsync(async () =>
        {
            StorageDbContext context = ambient.RequireContext();

            TStoredEntity? existing = await FindAsync(context, entity.Id, cancellationToken);

            return existing is null
                ? (await AddCoreAsync(entity, cancellationToken), EntityChangeType.Added)
                : (await UpdateCoreAsync(entity, cancellationToken), EntityChangeType.Updated);
        });

        Notify(result.Id, change);
        return result;
    }

    /// <inheritdoc />
    public async Task<TDomainEntity> UpdateAsync(TDomainEntity entity, CancellationToken cancellationToken = default)
    {
        TDomainEntity result = await transaction.InvokeAsync(() => UpdateCoreAsync(entity, cancellationToken));
        Notify(result.Id, EntityChangeType.Updated);
        return result;
    }

    // Runs inside transaction.InvokeAsync, so the ambient transactional context is always active.
    private async Task<TDomainEntity> UpdateCoreAsync(
        TDomainEntity entity,
        CancellationToken cancellationToken)
    {
        StorageDbContext context = ambient.RequireContext();

        Validator.ValidateObject(entity, new ValidationContext(entity), validateAllProperties: true);

        // Find the existing entity with tracking enabled
        TStoredEntity? existing = await FindAsync(context, entity.Id, cancellationToken);

        if (existing is null)
        {
            throw new EntityNotFoundException(entity.Id, typeof(TDomainEntity));
        }

        // check for optimistic concurrency conflict — compared at the database's persisted
        // (microsecond) precision so a full-precision in-memory token (e.g. the entity AddAsync
        // returns before any DB round-trip truncates it) does not spuriously conflict on the first
        // update after an insert. See ConcurrencyTokenExtensions.
        if (!existing.UpdatedAt.MatchesConcurrencyToken(entity.UpdatedAt))
        {
            throw new OptimisticConcurrencyException(entity.Id, typeof(TDomainEntity));
        }

        // Map the updated domain entity to storage entity, then stamp UpdatedAt centrally
        // so callers don't have to bump it (and don't fight the concurrency check above).
        TStoredEntity mapped = await mapper.Map(entity, cancellationToken);
        TStoredEntity updated = mapped with { UpdatedAt = DateTimeOffset.UtcNow };

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
    }

    protected virtual Task UpdateRelationsAsync(
        StorageDbContext context, 
        TStoredEntity storedEntity,
        CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public async Task<bool> RemoveAsync(Guid id, CancellationToken cancellationToken = default)
    {
        bool removed = await transaction.InvokeAsync(async () =>
        {
            StorageDbContext context = ambient.RequireContext();
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

        if (removed)
        {
            Notify(id, EntityChangeType.Removed);
        }
        return removed;
    }

    public async Task RemoveAllAsync(CancellationToken cancellationToken = default)
    {
        Guid[] removedIds = await transaction.InvokeAsync(async () =>
        {
            StorageDbContext context = ambient.RequireContext();
            DbSet<TStoredEntity> set = context.Set<TStoredEntity>();
            Guid[] ids = await set.AsNoTracking().Select(e => e.Id).ToArrayAsync(cancellationToken);
            set.RemoveRange(set);
            await context.SaveChangesAsync(cancellationToken);
            cache?.InvalidateAll();
            return ids;
        });

        foreach (Guid id in removedIds)
        {
            Notify(id, EntityChangeType.Removed);
        }
    }

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
    {
        // Sequential, not concurrent: a mapper may resolve related entities through the shared
        // ambient transaction context, and a DbContext does not allow concurrent operations.
        var mapped = new List<TDomainEntity>(stored.Count);
        foreach (TStoredEntity entity in stored)
        {
            mapped.Add(await mapper.Map(entity, cancellationToken));
        }
        return mapped;
    }

    /// <summary>
    /// Maps to the stored entity
    /// </summary>
    protected async Task<TStoredEntity?> Map(TDomainEntity? domain, CancellationToken cancellationToken = default)
        => domain is not null ? await mapper.Map(domain, cancellationToken) : null;
}