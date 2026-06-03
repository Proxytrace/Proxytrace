using Proxytrace.Domain.OptimizationProposal;
using Proxytrace.Domain.OptimizationTheory;

namespace Proxytrace.Application.Optimization.Internal.Validation;

/// <summary>
/// Validates a single kind of <see cref="IOptimizationTheory"/> by grounding it against
/// a baseline and a candidate test run, returning a Draft proposal when the change improves
/// the agent, or null when it does not.
/// </summary>
internal interface ITheoryValidator
{
    bool CanValidate(IOptimizationTheory theory);

    Task<IOptimizationProposal?> ValidateAsync(IOptimizationTheory theory, CancellationToken cancellationToken = default);
}
