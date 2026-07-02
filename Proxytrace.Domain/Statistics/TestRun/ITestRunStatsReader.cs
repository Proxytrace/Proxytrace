namespace Proxytrace.Domain.Statistics.TestRun;

/// <summary>
/// Server-side aggregates over the <see cref="TestRunStats"/> projection. The generic
/// <c>IStatsReader&lt;TestRunStats, TestRunStats.Filter&gt;.QueryAsync</c> materializes every matching
/// row; the table has no retention, so dashboard-scoped consumers that only need totals or the most
/// recent cohorts must aggregate in the database instead of in memory. Kept as a sibling interface so
/// the generic reader contract stays projection-agnostic.
/// </summary>
public interface ITestRunStatsReader
{
    /// <summary>
    /// Total test cases and passed cases across every run matching <paramref name="filter"/>,
    /// summed server-side (a single scalar row crosses the wire).
    /// </summary>
    Task<TestRunPassTotals> GetPassTotalsAsync(TestRunStats.Filter filter, CancellationToken cancellationToken = default);

    /// <summary>
    /// The <paramref name="limit"/> most recently completed (<c>GroupId</c>, <c>EndpointId</c>)
    /// cohorts matching <paramref name="filter"/>, aggregated server-side and returned in
    /// chronological order. Sample rows collapse with the same semantics as
    /// <see cref="TestRunStatsCohortExtensions.AggregateSamples"/>: <see cref="TestRunCohort.Passed"/>
    /// is the rounded mean across the cohort's samples and the cohort timestamp is the latest
    /// <c>RunCompletedAt</c>.
    /// </summary>
    Task<IReadOnlyList<TestRunCohort>> GetRecentCohortsAsync(TestRunStats.Filter filter, int limit, CancellationToken cancellationToken = default);
}

/// <summary>
/// Server-side pass totals across a set of test runs.
/// </summary>
public record TestRunPassTotals(int TotalCases, int TotalPassed);

/// <summary>
/// One (<c>GroupId</c>, <c>EndpointId</c>) cohort with its samples collapsed — the aggregate shape
/// behind the dashboard pass-rate sparkline. <see cref="Passed"/> is the rounded mean pass count
/// across the cohort's sample rows (matching
/// <see cref="TestRunStatsCohortExtensions.AggregateSamples"/>).
/// </summary>
public record TestRunCohort(
    Guid GroupId,
    Guid EndpointId,
    int TestCases,
    int Passed,
    DateTimeOffset LastRunCompletedAt);
