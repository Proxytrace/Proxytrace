using Proxytrace.Domain.OptimizationProposal;
using Proxytrace.Domain.TestRunGroup;

namespace Proxytrace.Application.Optimization;

public interface IOptimizer
{
    Task<IReadOnlyList<IOptimizationProposal>> DiscoverOptimizations(
        ITestRunGroup testRunGroup, 
        CancellationToken cancellationToken = default);
}
