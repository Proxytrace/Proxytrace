using Proxytrace.Domain.Statistics.TestRun;
using Proxytrace.Domain.TestRun;

namespace Proxytrace.Application.TestRun;

/// <summary>
/// All runs in a group that share one endpoint — a "cohort" of N samples. The UI averages a cohort's
/// per-case results; the optimization loop (anomaly detection + optimizers) reduces it to a single
/// <see cref="Representative"/> run plus aggregated <see cref="Stats"/> so N samples never fire N
/// duplicate anomalies or bias a proposal toward one lucky/unlucky sample.
/// </summary>
/// <param name="EndpointId">The endpoint all runs in this cohort target.</param>
/// <param name="Runs">The cohort's runs, ordered by <c>SampleIndex</c>.</param>
/// <param name="Representative">
/// The sample that stands in for the cohort: the median by pass count (tie → lowest sample index),
/// or — before stats have projected — the first completed sample, else the first run.
/// </param>
/// <param name="Stats">
/// Aggregated stats across the cohort's samples (mean pass count/duration/cost), with
/// <c>TestRunId</c> pinned to the representative. <c>null</c> until at least one sample has projected.
/// </param>
public sealed record RunCohort(
    Guid EndpointId,
    IReadOnlyList<ITestRun> Runs,
    ITestRun Representative,
    TestRunStats? Stats)
{
    /// <summary>
    /// Groups <paramref name="runs"/> by endpoint into cohorts, selecting each cohort's representative
    /// and aggregating its sample stats from <paramref name="statsByRunId"/>.
    /// </summary>
    public static IReadOnlyList<RunCohort> Build(
        IReadOnlyList<ITestRun> runs,
        IReadOnlyDictionary<Guid, TestRunStats> statsByRunId)
        => runs
            .GroupBy(r => r.Endpoint.Id)
            .Select(group =>
            {
                var ordered = group.OrderBy(r => r.SampleIndex).ToList();
                var representative = SelectRepresentative(ordered, statsByRunId);

                var sampleStats = ordered
                    .Select(r => statsByRunId.GetValueOrDefault(r.Id))
                    .OfType<TestRunStats>()
                    .ToList();
                TestRunStats? stats = sampleStats.Count > 0
                    ? TestRunStatsCohortExtensions.Aggregate(sampleStats, representative.Id)
                    : null;

                return new RunCohort(group.Key, ordered, representative, stats);
            })
            .ToList();

    private static ITestRun SelectRepresentative(
        IReadOnlyList<ITestRun> ordered,
        IReadOnlyDictionary<Guid, TestRunStats> statsByRunId)
    {
        // Prefer the median sample by pass count among those that have projected stats; ordered is
        // already by sample index so ThenBy keeps the tie-break deterministic (lowest sample index).
        var withStats = ordered
            .Select(r => statsByRunId.TryGetValue(r.Id, out var s)
                ? (run: r, passed: (int?)s.Passed)
                : (run: r, passed: (int?)null))
            .Where(x => x.passed.HasValue)
            .OrderBy(x => x.passed)
            .ThenBy(x => x.run.SampleIndex)
            .Select(x => x.run)
            .ToList();

        if (withStats.Count > 0)
            return withStats[(withStats.Count - 1) / 2];

        // Stats lag projection: fall back to a completed sample, else the first run.
        return ordered.FirstOrDefault(r => r.Status == TestRunStatus.Completed) ?? ordered[0];
    }
}
