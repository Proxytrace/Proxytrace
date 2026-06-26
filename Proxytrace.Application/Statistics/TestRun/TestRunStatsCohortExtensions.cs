namespace Proxytrace.Application.Statistics.TestRun;

/// <summary>
/// Collapses the per-sample <see cref="TestRunStats"/> rows of a sampled run group back down to one
/// row per endpoint cohort. Sampling writes one stats row per individual run, so a group with N
/// samples per endpoint produces N rows per endpoint; consumers that reason about "one result per
/// endpoint per group" (suite run aggregates, dashboard trends, anomaly baselines) aggregate the
/// samples first. Single-sample cohorts pass through unchanged.
/// </summary>
public static class TestRunStatsCohortExtensions
{
    /// <summary>
    /// Groups rows by (<c>GroupId</c>, <c>EndpointId</c>) and reduces each cohort to one synthetic
    /// row (mean <c>Passed</c>/duration/cost, latest <c>RunCompletedAt</c>). Only the sample
    /// dimension is collapsed — distinct endpoints stay distinct rows, matching pre-sampling shape.
    /// </summary>
    public static IReadOnlyList<TestRunStats> AggregateSamples(this IEnumerable<TestRunStats> stats)
        => stats
            .GroupBy(s => (s.GroupId, s.EndpointId))
            .Select(g => Aggregate(g.ToList()))
            .ToList();

    /// <summary>
    /// Reduces one endpoint cohort's sample rows to a single representative row: mean
    /// <c>Passed</c> (rounded), mean duration and cost, latest completion. <paramref name="testRunId"/>
    /// pins the synthetic row to a known representative run; when omitted it defaults to the median
    /// sample by pass count (tie → smallest id) so the choice is deterministic and not an outlier.
    /// </summary>
    public static TestRunStats Aggregate(IReadOnlyList<TestRunStats> samples, Guid? testRunId = null)
    {
        var first = samples[0];
        var ordered = samples.OrderBy(s => s.Passed).ThenBy(s => s.TestRunId).ToList();
        var representative = ordered[(ordered.Count - 1) / 2];

        var durations = samples.Select(s => s.TotalDuration).OfType<TimeSpan>().ToList();
        var costs = samples.Select(s => s.Cost).OfType<decimal>().ToList();

        return first with
        {
            TestRunId = testRunId ?? representative.TestRunId,
            Passed = (int)Math.Round(samples.Average(s => s.Passed)),
            TotalDuration = durations.Count > 0
                ? TimeSpan.FromTicks((long)durations.Average(d => d.Ticks))
                : null,
            Cost = costs.Count > 0 ? costs.Average() : null,
            Usage = representative.Usage,
            RunCompletedAt = samples.Max(s => s.RunCompletedAt),
        };
    }
}
