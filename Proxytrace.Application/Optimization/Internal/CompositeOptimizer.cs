using Proxytrace.Application.Statistics;
using Proxytrace.Application.Statistics.TestRun;
using Proxytrace.Application.TestRun;
using Proxytrace.Common.Async;
using Proxytrace.Domain.OptimizationTheory;
using Proxytrace.Domain.TestRun;
using Proxytrace.Domain.TestRunGroup;

namespace Proxytrace.Application.Optimization.Internal;

/// <summary>
/// Aggregates the theory-producing optimizer implementations. Deduplication, persistence
/// and validation of the produced theories are handled downstream by the theory validation
/// pipeline, so this type only fans out to the implementations and collects their hypotheses.
///
/// Builds the per-endpoint <see cref="RunCohort"/>s once and hands them to every implementation, so
/// each optimizer sees one representative run + aggregated stats per endpoint regardless of how many
/// samples the group ran.
/// </summary>
internal sealed class CompositeOptimizer : IOptimizer
{
    private readonly IReadOnlyCollection<IOptimizerImplementation> optimizers;
    private readonly ITestRunRepository testRuns;
    private readonly IStatsReader<TestRunStats, TestRunStats.Filter> runStats;

    public CompositeOptimizer(
        IReadOnlyCollection<IOptimizerImplementation> optimizers,
        ITestRunRepository testRuns,
        IStatsReader<TestRunStats, TestRunStats.Filter> runStats)
    {
        this.optimizers = optimizers.DistinctBy(x => x.GetType()).ToArray();
        this.testRuns = testRuns;
        this.runStats = runStats;
    }

    public async Task<IReadOnlyList<IOptimizationTheory>> DiscoverTheories(
        ITestRunGroup testRunGroup,
        CancellationToken cancellationToken = default)
    {
        IReadOnlyList<ITestRun> runs = await testRuns.GetByGroupAsync(testRunGroup.Id, cancellationToken);
        if (runs.Count == 0)
            return [];

        IReadOnlyList<TestRunStats> groupStats = await runStats.QueryAsync(
            new TestRunStats.Filter(GroupId: testRunGroup.Id), cancellationToken);
        var statsByRunId = groupStats.ToDictionary(s => s.TestRunId);
        IReadOnlyList<RunCohort> cohorts = RunCohort.Build(runs, statsByRunId);

        return (await optimizers
                .Select(optimizer => optimizer.DiscoverTheories(testRunGroup, cohorts, cancellationToken))
                .Await())
            .SelectMany(x => x)
            .ToArray();
    }
}
