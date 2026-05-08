namespace Trsr.Domain.OptimizationProposal;

/// <summary>
/// Repository for <see cref="IOptimizationProposal"/> entities.
/// </summary>
public interface IOptimizationProposalRepository : IRepository<IOptimizationProposal>
{
    /// <summary>
    /// Returns all proposals targeting the specified agent version, ordered by creation date descending.
    /// </summary>
    Task<IReadOnlyList<IOptimizationProposal>> GetByAgentAsync(
        Guid agentId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<IOptimizationProposal>> GetByProjectAsync(
        Guid projectId,
        CancellationToken cancellationToken = default);
}
