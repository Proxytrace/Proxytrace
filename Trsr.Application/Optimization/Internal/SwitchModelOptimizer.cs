using Trsr.Application.Statistics;
using Trsr.Application.Statistics.TestRun;
using Trsr.Domain.OptimizationProposal;
using Trsr.Domain.Proposal;
using Trsr.Domain.TestRun;
using Trsr.Domain.TestRunGroup;

namespace Trsr.Application.Optimization.Internal;

internal sealed class SwitchModelOptimizer : IOptimizerImplementation
{
    private readonly IOptimizationProposal.CreateNew factory;
    private readonly IStatsReader<TestRunStats, TestRunStats.Filter> runStats;

    public SwitchModelOptimizer(
        IOptimizationProposal.CreateNew factory,
        IStatsReader<TestRunStats, TestRunStats.Filter> runStats)
    {
        this.factory = factory;
        this.runStats = runStats;
    }

    public async Task<IReadOnlyList<IOptimizationProposal>> DiscoverOptimizations(
        ITestRunGroup testRunGroup,
        IReadOnlyList<ITestRun> testRuns,
        CancellationToken cancellationToken = default)
    {
        var currentEndpointId = testRunGroup.Suite.Agent.Endpoint.Id;

        var currentRun = testRuns.FirstOrDefault(x => x.Endpoint.Id == currentEndpointId);
        var alternativeRuns = testRuns.Where(x => x.Endpoint.Id != currentEndpointId).ToList();

        if (currentRun is null || alternativeRuns.Count == 0)
        {
            return [];
        }

        IReadOnlyList<TestRunStats> groupStats = await runStats.QueryAsync(
            new TestRunStats.Filter(GroupId: testRunGroup.Id), cancellationToken);
        Dictionary<Guid, TestRunStats> statsByRun = groupStats.ToDictionary(s => s.TestRunId);

        if (!statsByRun.TryGetValue(currentRun.Id, out TestRunStats? currentStats))
        {
            return [];
        }

        TestRunStats? best = null;
        foreach (ITestRun alt in alternativeRuns)
        {
            if (!statsByRun.TryGetValue(alt.Id, out TestRunStats? altStats))
            {
                continue;
            }
            if (!altStats.PassRate.HasValue)
            {
                continue;
            }
            if (best is null || altStats.PassRate > best.PassRate)
            {
                best = altStats;
            }
        }

        if (best is null || best.PassRate <= currentStats.PassRate)
        {
            return [];
        }

        TestRunStatsAggregate diff = best.ToAggregate() - currentStats.ToAggregate();

        var priority = diff.PassRate switch
        {
            > 0.20 => Priority.Critical,
            > 0.10 => Priority.High,
            > 0.05 => Priority.Medium,
            _ => Priority.Low
        };

        ITestRun bestRun = alternativeRuns.First(r => r.Id == best.TestRunId);
        var currentName = currentRun.Endpoint.Model.Name;
        var bestName = bestRun.Endpoint.Model.Name;
        var passRatePct = (diff.PassRate * 100)?.ToString("F1") ?? "?";
        var rationale = $"Switching from {currentName} to {bestName} improved the pass rate by {passRatePct}% in test run evidence."
            + (diff.Cost.HasValue ? $" Cost delta: {diff.Cost:+0.####;-0.####}." : "")
            + (diff.TotalDuration.HasValue ? $" Latency delta: {diff.TotalDuration:+s\\.f;-s\\.f}s." : "");

        var proposal = factory(
            agent: testRunGroup.Suite.Agent,
            priority: priority,
            rationale: rationale,
            details: new ModelSwitchDetails(
                ProposedEndpointId: bestRun.Endpoint.Id,
                ExpectedPassRateDelta: diff.PassRate,
                ExpectedCostDelta: diff.Cost,
                ExpectedLatencyDelta: diff.TotalDuration),
            evidenceTestRunIds: [currentRun.Id, bestRun.Id]);

        return [proposal];
    }
}
