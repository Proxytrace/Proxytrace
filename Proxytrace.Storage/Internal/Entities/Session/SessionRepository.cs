using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Proxytrace.Domain;
using Proxytrace.Domain.Events;
using Proxytrace.Domain.Session;

namespace Proxytrace.Storage.Internal.Entities.Session;

[UsedImplicitly]
internal class SessionRepository
    : AbstractRepository<ISession, SessionEntity>,
      ISessionRepository
{
    public SessionRepository(
        IMapper<ISession, SessionEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction,
        IEntityEventService entityEvents,
        AmbientDbContext ambient) : base(mapper, contextFactory, transaction, entityEvents, ambient)
    {
    }

    public async Task RecordActivityAsync(
        Guid sessionId,
        string externalKey,
        Guid projectId,
        long totalTokens,
        DateTimeOffset lastActivityAt,
        CancellationToken cancellationToken = default)
    {
        var context = contextFactory();
        if (context.Database.IsRelational())
        {
            if (await TryBumpAsync(context, sessionId, totalTokens, lastActivityAt, cancellationToken))
                return;
            try
            {
                context.Set<SessionEntity>().Add(NewRow(sessionId, externalKey, projectId, totalTokens, lastActivityAt));
                await context.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException)
            {
                // Lost the first-insert race to a concurrent ingester (unique PK / (ProjectId,
                // ExternalKey) index): the row exists now, so the bump must succeed.
                await TryBumpAsync(contextFactory(), sessionId, totalTokens, lastActivityAt, cancellationToken);
            }
            return;
        }

        // In-memory provider (unit tests / kiosk): no ExecuteUpdate support, single-process, so a
        // read-modify-write is race-free enough. We fetch with tracking and modify in place.
        var existing = await context.Set<SessionEntity>()
            .FirstOrDefaultAsync(e => e.Id == sessionId, cancellationToken);
        if (existing is null)
        {
            context.Set<SessionEntity>().Add(NewRow(sessionId, externalKey, projectId, totalTokens, lastActivityAt));
        }
        else
        {
            // Modify in place; don't set UpdatedAt to avoid concurrency token conflicts in in-memory provider
            context.Entry(existing).CurrentValues.SetValues(new
            {
                LastActivityAt = lastActivityAt,
                TraceCount = existing.TraceCount + 1,
                TotalTokens = existing.TotalTokens + totalTokens,
            });
        }
        await context.SaveChangesAsync(cancellationToken);
    }

    private static async Task<bool> TryBumpAsync(
        StorageDbContext context,
        Guid sessionId,
        long totalTokens,
        DateTimeOffset lastActivityAt,
        CancellationToken cancellationToken)
        => await context.Set<SessionEntity>()
            .Where(e => e.Id == sessionId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(e => e.LastActivityAt, lastActivityAt)
                .SetProperty(e => e.TraceCount, e => e.TraceCount + 1)
                .SetProperty(e => e.TotalTokens, e => e.TotalTokens + totalTokens)
                .SetProperty(e => e.UpdatedAt, lastActivityAt), cancellationToken) > 0;

    private static SessionEntity NewRow(
        Guid sessionId, string externalKey, Guid projectId, long totalTokens, DateTimeOffset lastActivityAt)
        => new()
        {
            Id = sessionId,
            ExternalKey = externalKey,
            ProjectId = projectId,
            LastActivityAt = lastActivityAt,
            TraceCount = 1,
            TotalTokens = totalTokens,
            CreatedAt = lastActivityAt,
            UpdatedAt = lastActivityAt,
        };

    public async Task<(IReadOnlyList<ISession> Items, int Total)> GetRecentAsync(
        Guid projectId,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = contextFactory()
            .Set<SessionEntity>()
            .AsNoTracking()
            .Where(e => e.ProjectId == projectId);

        var total = await query.CountAsync(cancellationToken);
        var stored = await query
            .OrderByDescending(e => e.LastActivityAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (await Map(stored, cancellationToken), total);
    }
}
