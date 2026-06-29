using Proxytrace.Domain.TestRun;

namespace Proxytrace.Api.Dto.TestRuns;

/// <summary>
/// The single definition of a test run's "latency" for the API/UI. Shared by every mapper that
/// surfaces a run-level latency (the run cards, the A/B-test proposal card) so the surfaces can't
/// drift apart.
/// </summary>
internal static class RunLatency
{
    /// <summary>
    /// A run's latency is the model's inference latency aggregated across the run's cases — the
    /// average of the per-case inference latencies (each <see cref="ITestResult.Latency"/> is a
    /// stopwatch around the single model call, the same quantity the matrix, <c>TestRunStats</c>, and
    /// the anomaly/model-switch latency checks use). It is deliberately NOT a wall-clock
    /// (<c>CompletedAt - CreatedAt</c>) timer over the whole run: that folds in the run's queue wait,
    /// the evaluator passes, and the parallel-execution overlap between cases — none of which is the
    /// model's latency — and would make a run that merely waited longer in the queue look slower.
    /// Null until the run has at least one result.
    /// </summary>
    public static long? AverageInferenceMs(ITestRun run)
        => run.TestResults.Count > 0
            ? (long)Math.Round(run.TestResults.Average(r => r.Latency.TotalMilliseconds))
            : null;
}
