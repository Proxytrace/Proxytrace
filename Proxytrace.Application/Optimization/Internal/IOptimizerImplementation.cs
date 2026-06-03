using Proxytrace.Domain.OptimizationTheory;
using Proxytrace.Domain.TestRun;
using Proxytrace.Domain.TestRunGroup;

namespace Proxytrace.Application.Optimization.Internal;

internal interface IOptimizerImplementation
{
    /// <summary>
    /// Produces unproven optimization theories from a completed test-run group.
    /// Theories are hypotheses only; the validation pipeline grounds them via A/B runs.
    /// </summary>
    Task<IReadOnlyList<IOptimizationTheory>> DiscoverTheories(
        ITestRunGroup testRunGroup,
        IReadOnlyList<ITestRun> testRuns,
        CancellationToken cancellationToken = default);
}
