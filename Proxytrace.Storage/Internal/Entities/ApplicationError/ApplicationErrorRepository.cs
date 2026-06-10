using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Proxytrace.Domain;
using Proxytrace.Domain.ApplicationError;
using Proxytrace.Domain.Events;
using Proxytrace.Domain.Paging;

namespace Proxytrace.Storage.Internal.Entities.ApplicationError;

[UsedImplicitly]
internal class ApplicationErrorRepository
    : AbstractRepository<IApplicationError, ApplicationErrorEntity>,
      IApplicationErrorRepository
{
    public ApplicationErrorRepository(
        IMapper<IApplicationError, ApplicationErrorEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction,
        IEntityEventService entityEvents,
        AmbientDbContext ambient) : base(mapper, contextFactory, transaction, entityEvents, ambient)
    {
    }

    public async Task<PagedResult<IApplicationError>> GetPagedNewestFirstAsync(
        int page,
        int pageSize,
        ApplicationErrorLevel? level,
        string? search,
        DateTimeOffset? from,
        DateTimeOffset? to,
        CancellationToken cancellationToken = default)
    {
        (page, pageSize) = Paging.Clamp(page, pageSize);

        var query = contextFactory().Set<ApplicationErrorEntity>().AsNoTracking();
        if (level.HasValue)
        {
            query = query.Where(e => e.Level == level.Value);
        }

        if (from.HasValue)
        {
            query = query.Where(e => e.CreatedAt >= from.Value);
        }

        if (to.HasValue)
        {
            query = query.Where(e => e.CreatedAt <= to.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim()}%";
            query = query.Where(e =>
                EF.Functions.Like(e.Message, pattern) ||
                (e.StackTrace != null && EF.Functions.Like(e.StackTrace, pattern)));
        }

        int total = await query.CountAsync(cancellationToken);
        var stored = await query
            .OrderByDescending(e => e.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var items = await Map(stored, cancellationToken);
        return new PagedResult<IApplicationError>(items, total, page, pageSize);
    }

    public async Task<int> RemoveOlderThanAsync(DateTimeOffset cutoffDate, CancellationToken cancellationToken = default)
    {
        var context = contextFactory();
        var query = context.Set<ApplicationErrorEntity>().Where(x => x.CreatedAt <= cutoffDate);

        if (context.Database.IsRelational())
            return await query.ExecuteDeleteAsync(cancellationToken);

        var toRemove = await query.ToListAsync(cancellationToken);
        context.Set<ApplicationErrorEntity>().RemoveRange(toRemove);
        return await context.SaveChangesAsync(cancellationToken);
    }

    public async Task<int> TrimToNewestAsync(int max, CancellationToken cancellationToken = default)
    {
        var context = contextFactory();
        var contextSet = context.Set<ApplicationErrorEntity>();

        // CreatedAt of the first row that should be dropped (the (max+1)-th newest). Everything at
        // or below this timestamp is removed, leaving the newest `max` rows.
        var cutoff = await contextSet
            .AsNoTracking()
            .OrderByDescending(e => e.CreatedAt)
            .Skip(max)
            .Select(e => (DateTimeOffset?)e.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (cutoff is null)
        {
            return 0; // fewer than `max` rows — nothing to trim
        }

        var query = contextSet.Where(x => x.CreatedAt <= cutoff.Value);

        if (context.Database.IsRelational())
            return await query.ExecuteDeleteAsync(cancellationToken);

        var toRemove = await query.ToListAsync(cancellationToken);
        contextSet.RemoveRange(toRemove);
        return await context.SaveChangesAsync(cancellationToken);
    }
}
