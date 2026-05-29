using Proxytrace.Common.Async;
using Proxytrace.Domain.OptimizationProposal;
using Proxytrace.Domain.TestRun;
using Proxytrace.Domain.TestRunGroup;

namespace Proxytrace.Application.Optimization.Internal;

internal sealed class CompositeOptimizer : IOptimizer
{
    /// <summary>
    /// Number of completed test-run groups against the agent that must occur after a
    /// Rejected/Accepted decision before an identical proposal is allowed to resurface.
    /// </summary>
    public const int ResurfaceThreshold = 3;

    private readonly IReadOnlyCollection<IOptimizerImplementation> optimizers;
    private readonly ITestRunRepository testRuns;
    private readonly IOptimizationProposalRepository proposals;
    private readonly ITestRunGroupRepository testRunGroups;

    public CompositeOptimizer(
        IReadOnlyCollection<IOptimizerImplementation> optimizers,
        ITestRunRepository testRuns,
        IOptimizationProposalRepository proposals,
        ITestRunGroupRepository testRunGroups)
    {
        this.optimizers = optimizers.DistinctBy(x => x.GetType()).ToArray();
        this.testRuns = testRuns;
        this.proposals = proposals;
        this.testRunGroups = testRunGroups;
    }

    public async Task<IReadOnlyList<IOptimizationProposal>> DiscoverOptimizations(ITestRunGroup testRunGroup, CancellationToken cancellationToken = default)
    {
        IReadOnlyList<ITestRun> runs = await testRuns.GetByGroupAsync(testRunGroup.Id, cancellationToken);
        if (runs.Count == 0)
            return [];

        var discovered = (await optimizers
                .Select(optimizer => optimizer.DiscoverOptimizations(testRunGroup, runs, cancellationToken))
                .Await())
            .SelectMany(x => x)
            .ToArray();

        var added = new List<IOptimizationProposal>(discovered.Length);
        foreach (var proposal in discovered)
        {
            if (await ShouldSuppressAsync(proposal, cancellationToken))
                continue;
            added.Add(await proposals.AddAsync(proposal, cancellationToken));
        }
        return added;
    }

    private async Task<bool> ShouldSuppressAsync(IOptimizationProposal proposal, CancellationToken cancellationToken)
    {
        var prior = await proposals.FindLatestByContentHashAsync(
            proposal.Agent.Id,
            proposal.ContentHash,
            cancellationToken);

        if (prior is null)
            return false;

        // An identical proposal is already pending review — skip the duplicate.
        if (prior.Status == ProposalStatus.Draft)
            return true;

        // Accepted or Rejected: suppress until enough new completed groups have run since the decision.
        var completedSince = await testRunGroups.CountCompletedSinceAsync(
            proposal.Agent.Id,
            prior.UpdatedAt,
            cancellationToken);

        return completedSince < ResurfaceThreshold;
    }
}
