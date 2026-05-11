using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Trsr.Domain;
using Trsr.Domain.Events;
using Trsr.Domain.OptimizationProposal;
using Trsr.Storage.Internal.Entities.Agent;

namespace Trsr.Storage.Internal.Entities.OptimizationProposal;

[UsedImplicitly]
internal class OptimizationProposalRepository :
    AbstractRepository<IOptimizationProposal, OptimizationProposalEntity>,
    IOptimizationProposalRepository
{
    public OptimizationProposalRepository(
        IMapper<IOptimizationProposal, OptimizationProposalEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction,
        IEntityEventService entityEvents) : base(mapper, contextFactory, transaction, entityEvents)
    {
    }

    public async Task<IReadOnlyList<IOptimizationProposal>> GetByAgentAsync(
        Guid agentId,
        CancellationToken cancellationToken = default)
    {
        var stored = await ContextFactory()
            .Set<OptimizationProposalEntity>()
            .AsNoTracking()
            .Where(e => e.Agent == agentId)
            .OrderByDescending(e => e.CreatedAt)
            .ToListAsync(cancellationToken);

        return await Map(stored, cancellationToken);
    }

    public async Task<IReadOnlyList<IOptimizationProposal>> GetByProjectAsync(
        Guid projectId,
        CancellationToken cancellationToken = default)
    {
        var context = ContextFactory();
        var stored = await context
            .Set<OptimizationProposalEntity>()
            .AsNoTracking()
            .Join(context.Set<AgentEntity>(),
                p => p.Agent,
                a => a.Id,
                (p, a) => new { Proposal = p, Agent = a })
            .Where(x => x.Agent.Project == projectId)
            .OrderByDescending(x => x.Proposal.CreatedAt)
            .Select(x => x.Proposal)
            .ToListAsync(cancellationToken);

        return await Map(stored, cancellationToken);
    }
}
