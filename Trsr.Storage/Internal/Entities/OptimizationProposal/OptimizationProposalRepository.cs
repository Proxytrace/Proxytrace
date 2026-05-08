using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Trsr.Domain;
using Trsr.Domain.OptimizationProposal;

namespace Trsr.Storage.Internal.Entities.OptimizationProposal;

[UsedImplicitly]
internal class OptimizationProposalRepository :
    AbstractRepository<IOptimizationProposal, OptimizationProposalEntity>,
    IOptimizationProposalRepository
{
    public OptimizationProposalRepository(
        IMapper<IOptimizationProposal, OptimizationProposalEntity> mapper,
        Func<StorageDbContext> contextFactory,
        ITransaction transaction) : base(mapper, contextFactory, transaction)
    {
    }

    public async Task<IReadOnlyList<IOptimizationProposal>> GetByAgentAsync(
        Guid agentId,
        CancellationToken cancellationToken = default)
    {
        var stored = await contextFactory()
            .Set<OptimizationProposalEntity>()
            .AsNoTracking()
            .Where(e => e.Agent == agentId)
            .OrderByDescending(e => e.CreatedAt.UtcTicks)
            .ToListAsync(cancellationToken);

        return await Map(stored, cancellationToken);
    }

    public Task<IReadOnlyList<IOptimizationProposal>> GetByProjectAsync(
        Guid projectId,
        CancellationToken cancellationToken = default)
        => throw new NotImplementedException();
}
