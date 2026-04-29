using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Trsr.Domain;
using Trsr.Domain.AgentCall;
using Trsr.Storage.Internal.Entities.Agent;
using Trsr.Storage.Internal.Entities.Model;
using Trsr.Storage.Internal.Entities.ModelEndpoint;

namespace Trsr.Storage.Internal.Entities.AgentCall;

[UsedImplicitly]
internal class AgentCallRepository : AbstractRepository<IAgentCall, AgentCallEntity>, IAgentCallRepository
{
    public AgentCallRepository(
        IMapper<IAgentCall, AgentCallEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction) : base(mapper, contextFactory, transaction)
    {
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
}
