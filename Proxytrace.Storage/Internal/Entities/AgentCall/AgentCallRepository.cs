using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Proxytrace.Domain;
using Proxytrace.Domain.AgentCall;
using Proxytrace.Domain.Events;
using Proxytrace.Domain.Project;
using Proxytrace.Domain.Search;
using Proxytrace.Storage.Internal.Entities.Agent;
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
        ISearchService searchService) : base(mapper, contextFactory, transaction, entityEvents)
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
        var query = context.Set<AgentCallEntity>().AsNoTracking();

        if (filter.AgentId.HasValue)
        {
            query = query.Where(e => e.AgentId == filter.AgentId.Value);
        }

        if (filter.ProjectId.HasValue)
        {
            var projectId = filter.ProjectId.Value;
            query = query.Where(e =>
                context.Set<AgentEntity>()
                    .Where(a => a.Project == projectId)
                    .Select(a => a.Id)
                    .Contains(e.AgentId));
        }

        if (filter.EndpointId is not null)
        {
            query = query.Where(e => e.EndpointId == filter.EndpointId);
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
                return ([], 0);
            }

            var matchingIds = await searchService.SearchEntityIdsAsync(
                filter.ProjectId.Value,
                filter.Query,
                SearchKind.AgentCall,
                MaxFulltextHits,
                cancellationToken);

            if (matchingIds.Count == 0)
            {
                return ([], 0);
            }

            var idSet = matchingIds.ToHashSet();
            query = query.Where(e => idSet.Contains(e.Id));
        }

        if (!filter.IncludeSystemAgents)
        {
            var nonSystemAgentIds = context.Set<AgentEntity>()
                .Where(a => !a.IsSystemAgent)
                .Select(a => a.Id);
            query = query.Where(e => nonSystemAgentIds.Contains(e.AgentId));
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

    public async Task<IReadOnlyDictionary<Guid, DateTimeOffset>> GetLastCallTimesAsync(
        CancellationToken cancellationToken = default)
    {
        var context = contextFactory();
        var result = await context.Set<AgentCallEntity>()
            .AsNoTracking()
            .GroupBy(e => e.AgentId)
            .Select(g => new { AgentId = g.Key, LastUsedAt = g.Max(e => e.CreatedAt) })
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
        var stored = await context.Set<AgentCallEntity>()
            .AsNoTracking()
            .Where(e => e.ConversationId == conversationId)
            .Where(e => context.Set<AgentEntity>()
                .Where(a => a.Project == projectId)
                .Select(a => a.Id)
                .Contains(e.AgentId))
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