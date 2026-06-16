using Microsoft.EntityFrameworkCore;
using Proxytrace.Domain;
using Proxytrace.Domain.Events;
using Proxytrace.Storage.Internal.Entities;

namespace Proxytrace.Storage.Internal;

/// <summary>
/// Base repository for entities that soft-delete (archive) instead of hard-deleting. Provides
/// <see cref="ArchiveAsync"/>, filters archived rows out of <see cref="GetAllAsync"/>, and exposes
/// <see cref="ArchiveRelationsAsync"/> for subclasses to clean up forward-looking memberships
/// (e.g. junction rows) in the same transaction. By-id lookups stay unfiltered (inherited from
/// <see cref="AbstractRepository{TDomainEntity,TStoredEntity}"/>) so history keeps resolving.
/// </summary>
internal abstract class ArchivableRepository<TDomainEntity, TStoredEntity>
    : AbstractRepository<TDomainEntity, TStoredEntity>, IArchivableRepository<TDomainEntity>
    where TDomainEntity : class, IArchivable
    where TStoredEntity : Entity, IArchivableEntity
{
    protected ArchivableRepository(
        IMapper<TDomainEntity, TStoredEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction,
        IEntityEventService entityEvents,
        AmbientDbContext ambient,
        IEntityCache<TDomainEntity>? cache = null)
        : base(mapper, contextFactory, transaction, entityEvents, ambient, cache)
    {
    }

    /// <inheritdoc />
    public async Task<bool> ArchiveAsync(Guid id, CancellationToken cancellationToken = default)
    {
        bool archived = await transaction.InvokeAsync(async () =>
        {
            StorageDbContext context = ambient.RequireContext();
            TStoredEntity? existing = await context.Set<TStoredEntity>().FindAsync([id], cancellationToken);
            if (existing is null)
                return false;

            if (existing.IsArchived)
                return true;

            await ArchiveRelationsAsync(context, id, cancellationToken);

            var entry = context.Entry(existing);
            entry.CurrentValues.SetValues(existing with { IsArchived = true, UpdatedAt = DateTimeOffset.UtcNow });
            await context.SaveChangesAsync(cancellationToken);
            InvalidateCacheEntry(id);
            return true;
        });

        if (archived)
            Notify(id, EntityChangeType.Removed);
        return archived;
    }

    /// <summary>
    /// Reverses an archive: clears the flag so the entity reappears in list/picker queries. Used when
    /// a by-key resolver (e.g. <c>GetOrCreateAsync</c>) matches an archived row that is about to be
    /// referenced by new work — leaving it archived would create a live-but-invisible "zombie".
    /// </summary>
    protected async Task UnarchiveAsync(Guid id, CancellationToken cancellationToken = default)
    {
        bool unarchived = await transaction.InvokeAsync(async () =>
        {
            StorageDbContext context = ambient.RequireContext();
            TStoredEntity? existing = await context.Set<TStoredEntity>().FindAsync([id], cancellationToken);
            if (existing is null || !existing.IsArchived)
                return false;

            var entry = context.Entry(existing);
            entry.CurrentValues.SetValues(existing with { IsArchived = false, UpdatedAt = DateTimeOffset.UtcNow });
            await context.SaveChangesAsync(cancellationToken);
            InvalidateCacheEntry(id);
            return true;
        }, cancellationToken);

        if (unarchived)
            Notify(id, EntityChangeType.Added);
    }

    /// <summary>
    /// Cleans up forward-looking references to the entity being archived (e.g. junction rows) so it
    /// is no longer used in new work, while leaving historical references intact. Runs inside the
    /// archive transaction, before the row is flagged. Default no-op.
    /// </summary>
    protected virtual Task ArchiveRelationsAsync(
        StorageDbContext context,
        Guid id,
        CancellationToken cancellationToken)
        => Task.CompletedTask;

    /// <inheritdoc />
    public override async Task<IReadOnlyList<TDomainEntity>> GetAllAsync(CancellationToken cancellationToken = default)
        => (await base.GetAllAsync(cancellationToken)).Where(e => !e.IsArchived).ToList();
}
