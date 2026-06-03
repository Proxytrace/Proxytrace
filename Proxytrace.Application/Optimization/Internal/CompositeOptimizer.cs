using Proxytrace.Common.Async;
using Proxytrace.Domain.OptimizationTheory;
using Proxytrace.Domain.TestRun;
using Proxytrace.Domain.TestRunGroup;

namespace Proxytrace.Application.Optimization.Internal;

/// <summary>
/// Aggregates the theory-producing optimizer implementations. Deduplication, persistence
/// and validation of the produced theories are handled downstream by the theory validation
/// pipeline, so this type only fans out to the implementations and collects their hypotheses.
/// </summary>
internal sealed class CompositeOptimizer : IOptimizer
{
    private readonly IReadOnlyCollection<IOptimizerImplementation> optimizers;
    private readonly ITestRunRepository testRuns;

    public CompositeOptimizer(
        IReadOnlyCollection<IOptimizerImplementation> optimizers,
        ITestRunRepository testRuns)
    {
        this.optimizers = optimizers.DistinctBy(x => x.GetType()).ToArray();
        this.testRuns = testRuns;
    }

    public async Task<IReadOnlyList<IOptimizationTheory>> DiscoverTheories(
        ITestRunGroup testRunGroup,
        CancellationToken cancellationToken = default)
    {
        IReadOnlyList<ITestRun> runs = await testRuns.GetByGroupAsync(testRunGroup.Id, cancellationToken);
        if (runs.Count == 0)
            return [];

        return (await optimizers
                .Select(optimizer => optimizer.DiscoverTheories(testRunGroup, runs, cancellationToken))
                .Await())
            .SelectMany(x => x)
            .ToArray();
    }
}
