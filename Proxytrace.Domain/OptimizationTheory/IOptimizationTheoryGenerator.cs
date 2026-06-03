using Proxytrace.Domain.OptimizationProposal;

namespace Proxytrace.Domain.OptimizationTheory;

/// <summary>
/// Master generator that dispatches to per-kind <see cref="IOptimizationTheory"/> generators.
/// </summary>
public interface IOptimizationTheoryGenerator : IDomainEntityGenerator<IOptimizationTheory>
{
    Task<IOptimizationTheory> CreateAsync(ProposalKind kind, CancellationToken cancellationToken = default);
}
