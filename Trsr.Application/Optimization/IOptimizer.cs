using Trsr.Domain.OptimizationProposal;
using Trsr.Domain.TestRunGroup;

namespace Trsr.Application.Optimization;

public interface IOptimizer
{
    Task<IReadOnlyList<IOptimizationProposal>> DiscoverOptimizations(
        ITestRunGroup testRunGroup, 
        CancellationToken cancellationToken = default);
}
