using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Proxytrace.Domain;
using Proxytrace.Domain.AgentCall;
using Proxytrace.Domain.Events;
using Proxytrace.Domain.Project;
using Proxytrace.Domain.Search;
using Proxytrace.Storage.Internal.Entities.Agent;
using Proxytrace.Storage.Internal.Entities.AgentVersion;
using Proxytrace.Storage.Internal.Entities.Model;
using Proxytrace.Storage.Internal.Entities.ModelEndpoint;

namespace Proxytrace.Storage.Internal.Entities.AgentCall;

[UsedImplicitly]
internal class AgentCallRepository : AbstractRepository<IAgentCall, AgentCallEntity>, IAgentCallRepository
{
    private const int MaxFulltextHits = 1000;

    private readonly ISearchService searchService;

    public AgentCallRepository(
        IMapper<IAgentCall, AgentCallEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction,
        IEntityEventService entityEvents,
        ISearchService searchService,
        AmbientDbContext ambient) : base(mapper, contextFactory, transaction, entityEvents, ambient)
    {
        this.searchService = searchService;
    }

    public async Task<(IReadOnlyList<IAgentCall> Items, int Total)> GetFilteredAsync(
        AgentCallFilter filter,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var context = contextFactory();
        var query = await BuildFilteredQueryAsync(context, filter, cancellationToken);
        if (query is null)
        {
            return ([], 0);
        }

        var total = await query.CountAsync(cancellationToken);

        var stored = await query
            .OrderByDescending(e => e.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var items = await Map(stored, cancellationToken);
        return (items, total);
    }

    public async Task<IReadOnlyList<AgentCallHistogramBucket>> GetHistogramAsync(
        AgentCallFilter filter,
        int buckets,
        CancellationToken cancellationToken = default)
    {
        var context = contextFactory();
        var query = await BuildFilteredQueryAsync(context, filter, cancellationToken);
        if (query is null)
        {
            return [];
        }

        var to = filter.To ?? DateTimeOffset.UtcNow;
        DateTimeOffset from;
        if (filter.From.HasValue)
        {
            from = filter.From.Value;
        }
        else
        {
            // One round-trip: a nullable Min is null exactly when nothing matches (index-backed).
            var earliest = await query
                .Select(e => (DateTimeOffset?)e.CreatedAt)
                .MinAsync(cancellationToken);
            if (earliest is null)
            {
                return [];
            }

            from = earliest.Value;
        }

        if (to <= from)
        {
            to = from.AddSeconds(1);
        }

        var rows = await query
            .Where(e => e.CreatedAt >= from && e.CreatedAt <= to)
            .Select(e => new { e.CreatedAt, e.HttpStatus })
            .ToListAsync(cancellationToken);

        if (rows.Count == 0)
        {
            return [];
        }

        var calls = rows.Select(r => (r.CreatedAt, r.HttpStatus)).ToList();
        return AgentCallHistogram.Build(calls, from, to, buckets);
    }

    /// <summary>
    /// Builds the filtered (but unpaged, unordered) query shared by list + histogram reads.
    /// Returns <see langword="null"/> when the filter provably matches nothing (e.g. a fulltext
    /// query with no hits, or a fulltext query without a project scope).
    /// </summary>
    private async Task<IQueryable<AgentCallEntity>?> BuildFilteredQueryAsync(
        StorageDbContext context,
        AgentCallFilter filter,
        CancellationToken cancellationToken)
    {
        var query = context.Set<AgentCallEntity>().AsNoTracking();

        if (filter.AgentId.HasValue)
        {
            var agentId = filter.AgentId.Value;
            var versionIdsForAgent = context.Set<AgentVersionEntity>()
                .Where(v => v.AgentId == agentId)
                .Select(v => v.Id);
            query = query.Where(e => versionIdsForAgent.Contains(e.AgentVersionId));
        }

        if (filter.ProjectId.HasValue)
        {
            var projectId = filter.ProjectId.Value;
            var versionIdsForProject = context.Set<AgentVersionEntity>()
                .Where(v => v.Project == projectId)
                .Select(v => v.Id);
            query = query.Where(e => versionIdsForProject.Contains(e.AgentVersionId));
        }

        if (filter.EndpointId is not null)
        {
            query = query.Where(e => e.EndpointId == filter.EndpointId);
        }

        if (filter.ConversationId.HasValue)
        {
            query = query.Where(e => e.ConversationId == filter.ConversationId.Value);
        }

        if (!string.IsNullOrWhiteSpace(filter.Model))
        {
            var search = filter.Model;
            var matchingEndpointIds = context.Set<ModelEndpointEntity>()
                .Where(me => context.Set<ModelEntity>()
                    .Any(m => m.Id == me.Model && EF.Functions.Like(m.Name, $"%{search}%")))
                .Select(me => me.Id);
            query = query.Where(e => matchingEndpointIds.Contains(e.EndpointId));
        }

        if (filter.From.HasValue)
        {
            query = query.Where(e => e.CreatedAt >= filter.From.Value);
        }

        if (filter.To.HasValue)
        {
            query = query.Where(e => e.CreatedAt <= filter.To.Value);
        }

        if (filter.HttpStatus.HasValue)
        {
            query = query.Where(e => e.HttpStatus == filter.HttpStatus.Value);
        }

        if (!string.IsNullOrWhiteSpace(filter.Query))
        {
            if (filter.ProjectId is null)
            {
                return null;
            }

            var matchingIds = await searchService.SearchEntityIdsAsync(
                filter.ProjectId.Value,
                filter.Query,
                SearchKind.AgentCall,
                MaxFulltextHits,
                cancellationToken);

            if (matchingIds.Count == 0)
            {
                return null;
            }

            var idSet = matchingIds.ToHashSet();
            query = query.Where(e => idSet.Contains(e.Id));
        }

        if (!filter.IncludeSystemAgents)
        {
            var nonSystemVersionIds =
                from v in context.Set<AgentVersionEntity>()
                join a in context.Set<AgentEntity>() on v.AgentId equals a.Id
                where !a.IsSystemAgent
                select v.Id;
            query = query.Where(e => nonSystemVersionIds.Contains(e.AgentVersionId));
        }

        return query;
    }

    public async Task<IReadOnlyDictionary<Guid, DateTimeOffset>> GetLastCallTimesAsync(
        CancellationToken cancellationToken = default)
    {
        var context = contextFactory();

        var result =
            await (from call in context.Set<AgentCallEntity>().AsNoTracking()
                   join version in context.Set<AgentVersionEntity>().AsNoTracking()
                       on call.AgentVersionId equals version.Id
                   group call by version.AgentId
                   into g
                   select new { AgentId = g.Key, LastUsedAt = g.Max(e => e.CreatedAt) })
                .ToDictionaryAsync(x => x.AgentId, x => x.LastUsedAt, cancellationToken);
        return result;
    }

    public async Task<IAgentCall?> FindLatestByConversationIdAsync(
        Guid conversationId,
        IProject project,
        CancellationToken cancellationToken = default)
    {
        var context = contextFactory();
        var projectId = project.Id;
        var versionIdsForProject = context.Set<AgentVersionEntity>()
            .Where(v => v.Project == projectId)
            .Select(v => v.Id);
        var stored = await context.Set<AgentCallEntity>()
            .AsNoTracking()
            .Where(e => e.ConversationId == conversationId)
            .Where(e => versionIdsForProject.Contains(e.AgentVersionId))
            .OrderByDescending(e => e.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        return stored is null
            ? null
            : await mapper.Map(stored, cancellationToken);
    }

    public Task<int> RemoveOlderThanAsync(DateTimeOffset cutoffDate, CancellationToken cancellationToken = default)
    {
        var context = contextFactory();
        var contextSet = context.Set<AgentCallEntity>();

        var toRemove = contextSet
            .AsNoTracking()
            .Where(x => x.CreatedAt <= cutoffDate);

        contextSet.RemoveRange(toRemove);

        return context.SaveChangesAsync(cancellationToken);
    }
}
