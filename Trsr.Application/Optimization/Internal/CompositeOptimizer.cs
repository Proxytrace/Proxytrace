using Trsr.Common.Async;
using Trsr.Domain;
using Trsr.Domain.OptimizationProposal;
using Trsr.Domain.TestRun;
using Trsr.Domain.TestRunGroup;

namespace Trsr.Application.Optimization.Internal;

internal sealed class CompositeOptimizer : IOptimizer
{
    private readonly IReadOnlyCollection<IOptimizerImplementation> optimizers;
    private readonly ITestRunRepository testRuns;
    private readonly IRepository<IOptimizationProposal> proposals;

    public CompositeOptimizer(
        IReadOnlyCollection<IOptimizerImplementation> optimizers,
        ITestRunRepository testRuns,
        IRepository<IOptimizationProposal> proposals)
    {
        this.optimizers = optimizers.DistinctBy(x => x.GetType()).ToArray();
        this.testRuns = testRuns;
        this.proposals = proposals;
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

        return (await discovered
                .Select(p => proposals.AddAsync(p, cancellationToken))
                .Await())
            .ToList();
    }
}
