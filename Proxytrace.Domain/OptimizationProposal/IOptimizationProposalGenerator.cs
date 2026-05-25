namespace Proxytrace.Domain.OptimizationProposal;

/// <summary>
/// Master generator that dispatches to per-kind <see cref="IOptimizationProposal"/> generators.
/// </summary>
public interface IOptimizationProposalGenerator : IDomainEntityGenerator<IOptimizationProposal>
{
    Task<IOptimizationProposal> CreateAsync(ProposalKind kind, CancellationToken cancellationToken = default);
}
