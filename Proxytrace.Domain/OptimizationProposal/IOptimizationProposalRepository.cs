namespace Proxytrace.Domain.OptimizationProposal;

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

    /// <summary>
    /// Returns the most-recently-updated proposal for the given agent with the specified
    /// <see cref="IOptimizationProposal.ContentHash"/>, or null if none exists.
    /// Used by the optimizer to detect duplicate suggestions.
    /// </summary>
    Task<IOptimizationProposal?> FindLatestByContentHashAsync(
        Guid agentId,
        string contentHash,
        CancellationToken cancellationToken = default);
}
