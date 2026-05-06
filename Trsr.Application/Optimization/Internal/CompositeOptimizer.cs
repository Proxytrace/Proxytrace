using Trsr.Common.Async;
using Trsr.Domain.Proposal;
using Trsr.Domain.TestRun;
using Trsr.Domain.TestRunGroup;

namespace Trsr.Application.Optimization.Internal;

internal sealed class CompositeOptimizer : IOptimizer
{
    private readonly IReadOnlyCollection<IOptimizerImplementation> optimizers;
    private readonly ITestRunRepository testRuns;

    public CompositeOptimizer(
        IReadOnlyCollection<IOptimizerImplementation> optimizers,
        ITestRunRepository testRuns)
    {
        this.optimizers = optimizers;
        this.testRuns = testRuns;
    }
    
    public async Task<IReadOnlyList<IProposal>> DiscoverOptimizations(ITestRunGroup testRunGroup, CancellationToken cancellationToken = default)
    {
        IReadOnlyList<ITestRun> runs = await testRuns.GetByGroupAsync(testRunGroup.Id, cancellationToken);
        if (runs.Count == 0)
        {
            return [];
        }
        
        return (await optimizers
                .Select(optimizer => optimizer.DiscoverOptimizations(testRunGroup, runs, cancellationToken))
                .Await())
            .SelectMany(x => x)
            .ToArray();
    }
}