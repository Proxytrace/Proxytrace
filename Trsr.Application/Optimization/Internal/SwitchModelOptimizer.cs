using Trsr.Domain.OptimizationProposal;
using Trsr.Domain.Proposal;
using Trsr.Domain.TestRun;
using Trsr.Domain.TestRunGroup;

namespace Trsr.Application.Optimization.Internal;

internal sealed class SwitchModelOptimizer : IOptimizerImplementation
{
    private readonly IOptimizationProposal.CreateNew factory;

    public SwitchModelOptimizer(IOptimizationProposal.CreateNew factory)
    {
        this.factory = factory;
    }

    public Task<IReadOnlyList<IOptimizationProposal>> DiscoverOptimizations(
        ITestRunGroup testRunGroup,
        IReadOnlyList<ITestRun> testRuns,
        CancellationToken cancellationToken = default)
    {
        var currentEndpointId = testRunGroup.Suite.Agent.Endpoint.Id;

        var currentRun = testRuns.FirstOrDefault(x => x.Endpoint.Id == currentEndpointId);
        var alternativeRuns = testRuns.Where(x => x.Endpoint.Id != currentEndpointId).ToList();

        if (currentRun is null || alternativeRuns.Count == 0)
            return Task.FromResult<IReadOnlyList<IOptimizationProposal>>([]);

        var best = alternativeRuns
            .Where(x => x.Statistics.PassRate.HasValue)
            .OrderByDescending(x => x.Statistics.PassRate)
            .FirstOrDefault();

        if (best is null || best.Statistics.PassRate <= currentRun.Statistics.PassRate)
            return Task.FromResult<IReadOnlyList<IOptimizationProposal>>([]);

        var diff = best.Statistics - currentRun.Statistics;

        var priority = diff.PassRate switch
        {
            > 0.20 => Priority.Critical,
            > 0.10 => Priority.High,
            > 0.05 => Priority.Medium,
            _ => Priority.Low
        };

        var currentName = currentRun.Endpoint.Model.Name;
        var bestName = best.Endpoint.Model.Name;
        var passRatePct = (diff.PassRate * 100)?.ToString("F1") ?? "?";
        var rationale = $"Switching from {currentName} to {bestName} improved the pass rate by {passRatePct}% in test run evidence."
            + (diff.Cost.HasValue ? $" Cost delta: {diff.Cost:+0.####;-0.####}." : "")
            + (diff.Latency.HasValue ? $" Latency delta: {diff.Latency:+s\\.f;-s\\.f}s." : "");

        var proposal = factory(
            agent: testRunGroup.Suite.Agent,
            priority: priority,
            rationale: rationale,
            details: new ModelSwitchDetails(
                ProposedEndpointId: best.Endpoint.Id,
                ExpectedPassRateDelta: diff.PassRate,
                ExpectedCostDelta: diff.Cost,
                ExpectedLatencyDelta: diff.Latency),
            evidenceTestRunIds: [currentRun.Id, best.Id]);

        return Task.FromResult<IReadOnlyList<IOptimizationProposal>>([proposal]);
    }
}
