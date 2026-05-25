using Proxytrace.Domain.OptimizationProposal;
using Proxytrace.Domain.TestRun;
using Proxytrace.Domain.TestRunGroup;

namespace Proxytrace.Application.Optimization.Internal;

internal interface IOptimizerImplementation
{
    Task<IReadOnlyList<IOptimizationProposal>> DiscoverOptimizations(
        ITestRunGroup testRunGroup,
        IReadOnlyList<ITestRun> testRuns,
        CancellationToken cancellationToken = default);
}
