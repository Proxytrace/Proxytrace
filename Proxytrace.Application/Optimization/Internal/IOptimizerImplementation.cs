using Proxytrace.Application.TestRun;
using Proxytrace.Domain.OptimizationTheory;
using Proxytrace.Domain.TestRunGroup;

namespace Proxytrace.Application.Optimization.Internal;

internal interface IOptimizerImplementation
{
    /// <summary>
    /// Produces unproven optimization theories from a completed test-run group.
    /// Theories are hypotheses only; the validation pipeline grounds them via A/B runs.
    /// </summary>
    /// <param name="cohorts">
    /// One <see cref="RunCohort"/> per endpoint — the group's runs already grouped by endpoint with
    /// the per-endpoint representative + aggregated stats resolved, so sampling is transparent here.
    /// </param>
    Task<IReadOnlyList<IOptimizationTheory>> DiscoverTheories(
        ITestRunGroup testRunGroup,
        IReadOnlyList<RunCohort> cohorts,
        CancellationToken cancellationToken = default);
}
