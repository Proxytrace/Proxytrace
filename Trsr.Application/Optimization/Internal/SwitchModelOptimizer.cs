using Trsr.Application.Statistics;
using Trsr.Application.Statistics.TestRun;
using Trsr.Domain.OptimizationProposal;
using Trsr.Domain.Proposal;
using Trsr.Domain.TestRun;
using Trsr.Domain.TestRunGroup;

namespace Trsr.Application.Optimization.Internal;

/// <summary>
/// Optimizer implementation that checks whether a model switch is recommended
/// (e.g. claude-sonnet-4.5 -> claude-sonnet-4.6)
/// </summary>
internal sealed class SwitchModelOptimizer : IOptimizerImplementation
{
    private readonly IModelSwitchProposal.CreateNew factory;
    private readonly IStatsReader<TestRunStats, TestRunStats.Filter> runStats;

    public SwitchModelOptimizer(
        IModelSwitchProposal.CreateNew factory,
        IStatsReader<TestRunStats, TestRunStats.Filter> runStats)
    {
        this.factory = factory;
        this.runStats = runStats;
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<IOptimizationProposal>> DiscoverOptimizations(
        ITestRunGroup testRunGroup,
        IReadOnlyList<ITestRun> testRuns,
        CancellationToken cancellationToken = default)
    {
        var currentEndpointId = testRunGroup.Suite.Agent.Endpoint.Id;
        var currentRun = testRuns.FirstOrDefault(x => x.Endpoint.Id == currentEndpointId);
        var alternativeRuns = testRuns.Where(x => x.Endpoint.Id != currentEndpointId).ToList();

        // we need a run that indicates the currently used endpoint, as well as least 1 alternative
        if (currentRun is null || alternativeRuns.Count == 0)
        {
            return [];
        }

        // get statistics for test runs
        IReadOnlyList<TestRunStats> groupStats = await runStats.QueryAsync(
            new TestRunStats.Filter(GroupId: testRunGroup.Id), cancellationToken);
        
        // remove stats where we dont have passrate 
        groupStats = groupStats.Where(x => x.PassRate.HasValue).ToList();
        
        // too few stats to compare
        if (groupStats.Count < 2)
        {
            return [];
        }
        
        var best = getBestStats(groupStats);
        if(best.Stats.TestRunId == currentRun.Id)
        {
            // the current run is already the best, no optimization needed
            return []; 
        }

        var priority = best.Diff.PassRate switch
        {
            > 0.20 => Priority.Critical,
            > 0.10 => Priority.High,
            > 0.05 => Priority.Medium,
            _ => Priority.Low
        };

        var currentStats = groupStats.First(x => x.TestRunId == currentRun.Id);
        ITestRun bestRun = testRuns.First(r => r.Id == best.Stats.TestRunId);
        var currentName = currentRun.Endpoint.Model.Name;
        var bestName = bestRun.Endpoint.Model.Name;
        var passRatePct = (best.Diff.PassRate * 100)?.ToString("F1") ?? "?";
        var rationale = $"Switching from {currentName} to {bestName} improved the pass rate by {passRatePct}% in test run evidence."
            + (best.Diff.Cost.HasValue ? $" Cost delta: {best.Diff.Cost:+0.####;-0.####}." : "")
            + (best.Diff.TotalDuration.HasValue ? $" Latency delta: {best.Diff.TotalDuration.Value.TotalSeconds}s" : "");

        var proposal = factory(
            agent: testRunGroup.Suite.Agent,
            priority: priority,
            rationale: rationale,
            proposedEndpoint: bestRun.Endpoint,
            currentPassRate: currentStats.PassRate,
            proposedPassRate: best.Stats.PassRate,
            expectedCostDelta: best.Diff.Cost,
            expectedLatencyDelta: best.Diff.TotalDuration,
            evidenceTestRunIds: [currentRun.Id, bestRun.Id],
            abTestRun: bestRun);

        return [proposal];
    }

    private TestRunStatsWithDiff getBestStats(params IReadOnlyCollection<TestRunStats> stats)
    {
        throw new NotImplementedException();
    }
    
    private record TestRunStatsWithDiff(TestRunStats Stats, TestRunStatsAggregate Diff);
}
