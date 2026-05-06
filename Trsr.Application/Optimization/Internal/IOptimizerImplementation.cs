using Trsr.Domain.Proposal;
using Trsr.Domain.TestRun;
using Trsr.Domain.TestRunGroup;

namespace Trsr.Application.Optimization.Internal;

internal interface IOptimizerImplementation
{
    Task<IReadOnlyList<IProposal>> DiscoverOptimizations(
        ITestRunGroup testRunGroup, 
        IReadOnlyList<ITestRun> testRuns,
        CancellationToken cancellationToken = default);

}