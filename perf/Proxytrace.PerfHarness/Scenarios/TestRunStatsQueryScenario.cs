using Autofac;
using Proxytrace.Application.Statistics;
using Proxytrace.Application.Statistics.TestRun;
using Proxytrace.PerfHarness.Bootstrap;
using Proxytrace.PerfHarness.Reporting;

namespace Proxytrace.PerfHarness.Scenarios;

/// <summary>
/// Times the suite-scoped <c>TestRunStats</c> projection query (issue #253) against the seeded table.
/// The test-suites controller loads finalized run statistics for the suites on the current page (and
/// for a single suite GET); before #253 it materialized the whole <c>TestRunStatsEntity</c> table and
/// filtered in memory, an O(all-rows) read on every suites list. The fix pushes the suite set into SQL
/// (<c>WHERE SuiteId IN (...)</c>), so this scenario measures that scoped read — both a single suite
/// (the single-suite GET) and a page of ~50 suites (the suites list) — against a large seeded table.
/// </summary>
internal static class TestRunStatsQueryScenario
{
    public static async Task<IReadOnlyList<MetricResult>> RunAsync(
        PerfContainer container,
        PerfBudgets budgets,
        int warmup,
        int iterations,
        CancellationToken cancellationToken)
    {
        using var scope = container.BeginScope();
        var reader = scope.Resolve<IStatsReader<TestRunStats, TestRunStats.Filter>>();

        // Discover the seeded suites once, outside the timed loop. An empty filter materializes the
        // whole table — exactly the O(all-rows) read #253 removed from the request path — so it is
        // intentionally kept out of the measured loop and used only to pick representative target
        // suite ids (the seeder's suite ids are synthetic and not known to this process otherwise).
        IReadOnlyList<TestRunStats> all = await reader.QueryAsync(new TestRunStats.Filter(), cancellationToken);
        if (all.Count == 0)
        {
            throw new InvalidOperationException("No TestRunStats rows found — run `seed` against this database first.");
        }

        Guid[] suiteIds = all.Select(r => r.SuiteId).Distinct().ToArray();
        // Busiest suite ≈ a realistic single-suite GET (most rows to project).
        Guid singleSuite = all.GroupBy(r => r.SuiteId).OrderByDescending(g => g.Count()).First().Key;
        // A page of suites ≈ the suites-list path (controller pages 50 suites by default).
        Guid[] suitePage = suiteIds.Take(50).ToArray();

        Console.WriteLine($"[db-layer] TestRunStats rows={all.Count:N0}, suites={suiteIds.Length:N0}, page={suitePage.Length}");

        var results = new List<MetricResult>();

        async Task Measure(string name, Func<Task> action)
        {
            var (p50, p95) = await PerfReport.MeasureLatencyAsync(warmup, iterations, action);
            Console.WriteLine($"[db-layer] {name,-26} p50={p50,8:N1}ms  p95={p95,8:N1}ms");
            results.Add(new MetricResult("db-layer", name, p95, budgets.DbQueryBudget(name), "ms", BudgetDirection.LowerIsBetter));
        }

        await Measure("testRunStatsBySuite",
            () => reader.QueryAsync(new TestRunStats.Filter(SuiteIds: [singleSuite]), cancellationToken));
        await Measure("testRunStatsBySuitePage",
            () => reader.QueryAsync(new TestRunStats.Filter(SuiteIds: suitePage), cancellationToken));

        return results;
    }
}
