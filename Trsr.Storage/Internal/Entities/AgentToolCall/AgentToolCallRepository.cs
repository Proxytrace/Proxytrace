using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.AgentToolCall;
using Trsr.Storage.Internal.Entities.AgentCall;

namespace Trsr.Storage.Internal.Entities.AgentToolCall;

[UsedImplicitly]
internal class AgentToolCallRepository : AbstractRepository<IAgentToolCall, AgentToolCallEntity>, IAgentToolCallRepository
{
    public AgentToolCallRepository(
        IMapper<IAgentToolCall, AgentToolCallEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction) : base(mapper, contextFactory, transaction)
    {
    }

    public async Task<IReadOnlyList<IAgentToolCall>> GetByAgentCallAsync(
        Guid agentCallId,
        CancellationToken cancellationToken = default)
    {
        var stored = await contextFactory()
            .Set<AgentToolCallEntity>()
            .AsNoTracking()
            .Where(e => e.AgentCallId == agentCallId)
            .OrderBy(e => e.CreatedAt)
            .ToListAsync(cancellationToken);
        return await Map(stored, cancellationToken);
    }

    public async Task<Guid?> FindAgentCallIdByToolCallIdsAsync(
        IReadOnlyCollection<string> toolCallIds,
        IAgent agent,
        CancellationToken cancellationToken = default)
    {
        if (toolCallIds.Count == 0)
        {
            return null;
        }

        var context = contextFactory();
        var match = await context.Set<AgentToolCallEntity>()
            .AsNoTracking()
            .Where(e => toolCallIds.Contains(e.ToolCallId))
            .Where(e => context.Set<AgentCallEntity>()
                .Where(ac => ac.AgentId == agent.Id)
                .Select(ac => ac.Id)
                .Contains(e.AgentCallId))
            .OrderByDescending(e => e.CreatedAt)
            .Select(e => (Guid?)e.AgentCallId)
            .FirstOrDefaultAsync(cancellationToken);

        return match;
    }
}
