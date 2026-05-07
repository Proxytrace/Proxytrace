using Trsr.Domain.OptimizationProposal;
using Trsr.Domain.TestRun;
using Trsr.Domain.TestRunGroup;

namespace Trsr.Application.Optimization.Internal;

internal sealed class RebuildPromptOptimizer : IOptimizerImplementation
{
    public async Task<IReadOnlyList<IOptimizationProposal>> DiscoverOptimizations(
        ITestRunGroup testRunGroup,
        IReadOnlyList<ITestRun> testRuns,
        CancellationToken cancellationToken = default)
    {
        // select the testrun with the endpoint the model is currently using
        ITestRun? relevantTestRun = testRuns
            .FirstOrDefault(x => x.Endpoint.Id == testRunGroup.Suite.Agent.Endpoint.Id);
        if (relevantTestRun is null)
        {
            return [];
        }

        throw new NotImplementedException();
    }
}