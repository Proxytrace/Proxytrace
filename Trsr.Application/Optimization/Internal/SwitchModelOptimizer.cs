using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Proposal;
using Trsr.Domain.TestRun;
using Trsr.Domain.TestRunGroup;

namespace Trsr.Application.Optimization.Internal;

internal sealed class SwitchModelOptimizer : IOptimizerImplementation
{
    public SwitchModelOptimizer(ITestRunGroupRepository testRuns)
    {
        
    }
    
    public async Task<IReadOnlyList<IProposal>> DiscoverOptimizations(
        ITestRunGroup testRunGroup,
        IReadOnlyList<ITestRun> testRuns,
        CancellationToken cancellationToken = default)
    {
        var currentEndpoint = testRunGroup.Suite.Agent.Endpoint;
        
        if (testRuns.All(x => x.Endpoint.Id != currentEndpoint.Id) || testRuns.Count(x => x.Endpoint.Id != currentEndpoint.Id) == 0)
        {
            // no model optimization possible, because we did not test against the current and another model
            return [];
        }
        
        var currentStatistics = testRuns.First(x => x.Endpoint.Id == currentEndpoint.Id).Statistics;
        
        var best = testRuns
            .Where(x => x.Statistics.PassRate.HasValue)
            .OrderByDescending(x => x.Statistics.PassRate)
            .FirstOrDefault();

        if (best == null || best.Endpoint.Id == currentEndpoint.Id)
        {
            return [];
        }
        
        var cheapest = testRuns
            .Where(x => x.Statistics.Cost.HasValue)
            .OrderBy(x => x.Statistics.Cost)
            .FirstOrDefault();
        
        var fastest = testRuns
            .Where(x => x.Statistics.Latency.HasValue)
            .OrderBy(x => x.Statistics.Latency)
            .FirstOrDefault();

        if(best.Endpoint.Id != fastest?.Endpoint.Id && best.Endpoint.Id == cheapest?.Endpoint.Id)
        {
            return [];
        }
        
        TestRunStatistics expectedDiff = best.Statistics - currentStatistics;

        throw new NotImplementedException();
    }
}