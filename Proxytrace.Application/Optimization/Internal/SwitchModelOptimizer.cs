using Proxytrace.Application.Statistics;
using Proxytrace.Application.Statistics.TestRun;
using Proxytrace.Domain.OptimizationTheory;
using Proxytrace.Domain.Proposal;
using Proxytrace.Domain.TestRun;
using Proxytrace.Domain.TestRunGroup;

namespace Proxytrace.Application.Optimization.Internal;

/// <summary>
/// Optimizer implementation that hypothesises switching the agent's model endpoint
/// when an alternative wins on cost or latency without regressing pass rate.
/// </summary>
internal sealed class SwitchModelOptimizer : IOptimizerImplementation
{
    /// <summary>
    /// Minimum relative win (vs the runner-up) the best model must have on its winning metric.
    /// </summary>
    private const double MinMargin = 0.10;

    private readonly IModelSwitchTheory.CreateNew factory;
    private readonly IStatsReader<TestRunStats, TestRunStats.Filter> runStats;

    public SwitchModelOptimizer(
        IModelSwitchTheory.CreateNew factory,
        IStatsReader<TestRunStats, TestRunStats.Filter> runStats)
    {
        this.factory = factory;
        this.runStats = runStats;
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<IOptimizationTheory>> DiscoverTheories(
        ITestRunGroup testRunGroup,
        IReadOnlyList<ITestRun> testRuns,
        CancellationToken cancellationToken = default)
    {
        var currentEndpointId = testRunGroup.Suite.Agent.Endpoint.Id;
        var currentRun = testRuns.FirstOrDefault(x => x.Endpoint.Id == currentEndpointId);
        var alternativeRuns = testRuns.Where(x => x.Endpoint.Id != currentEndpointId).ToList();

        // we need a run for the currently used endpoint, plus at least one alternative
        if (currentRun is null || alternativeRuns.Count == 0)
        {
            return [];
        }

        IReadOnlyList<TestRunStats> groupStats = await runStats.QueryAsync(
            new TestRunStats.Filter(GroupId: testRunGroup.Id), cancellationToken);

        // pass rate is the regression gate for every comparison; drop runs that lack it
        groupStats = groupStats.Where(x => x.PassRate.HasValue).ToList();

        // need at least a winner and a runner-up to compare against
        if (groupStats.Count < 2)
        {
            return [];
        }

        var currentStats = groupStats.FirstOrDefault(x => x.TestRunId == currentRun.Id);
        if (currentStats is null)
        {
            return [];
        }

        // evaluate both metric paths; pick the qualifying winner that saves most vs the current model
        Candidate? chosen = new[] { Metric.Cost, Metric.Latency }
            .Select(metric => Evaluate(metric, groupStats, currentRun.Id, currentStats))
            .Where(c => c is not null)
            .Cast<Candidate>()
            .Select(c => c)
            .OrderByDescending(c => c.RelativeSaving)
            .FirstOrDefault();

        if (chosen is null)
        {
            return [];
        }

        TestRunStats winner = chosen.Winner;
        ITestRun bestRun = testRuns.First(r => r.Id == winner.TestRunId);

        Priority priority = chosen.RelativeSaving switch
        {
            >= 0.50 => Priority.High,
            >= 0.25 => Priority.Medium,
            _ => Priority.Low,
        };

        var metricLabel = chosen.Metric == Metric.Cost ? "cost" : "latency";
        var savingPct = chosen.RelativeSaving > double.MinValue
            ? (chosen.RelativeSaving * 100).ToString("F1")
            : "?";
        var currentName = currentRun.Endpoint.Model.Name;
        var bestName = bestRun.Endpoint.Model.Name;
        var rationale =
            $"Switching from {currentName} to {bestName} cuts {metricLabel} by {savingPct}% vs current "
            + $"with no pass-rate regression. {metricLabel}: {FormatMetric(chosen.Metric, winner)} vs "
            + $"{FormatMetric(chosen.Metric, currentStats)}.";

        var theory = factory(
            agent: testRunGroup.Suite.Agent,
            suite: testRunGroup.Suite,
            source: TheorySource.Optimizer,
            priority: priority,
            rationale: rationale,
            proposedEndpoint: bestRun.Endpoint,
            evidenceTestRunIds: [currentRun.Id, bestRun.Id]);

        return [theory];
    }

    /// <summary>
    /// Ranks all runs by <paramref name="metric"/> (lower is better, current included) and returns a
    /// qualifying candidate when the best alternative beats the runner-up by <see cref="MinMargin"/>,
    /// does not regress the other metric, and does not regress pass rate — all measured against the runner-up.
    /// </summary>
    private static Candidate? Evaluate(
        Metric metric,
        IReadOnlyList<TestRunStats> stats,
        Guid currentRunId,
        TestRunStats currentStats)
    {
        var ranked = stats
            .Where(s => GetMetric(s, metric).HasValue)
            .OrderBy(s => GetMetric(s, metric) ?? 0d)
            .ToList();

        if (ranked.Count < 2)
        {
            return null;
        }

        TestRunStats winner = ranked[0];
        TestRunStats runnerUp = ranked[1];

        // current model is already best on this metric: nothing to switch to
        if (winner.TestRunId == currentRunId)
        {
            return null;
        }

        double winnerValue = GetMetric(winner, metric) ?? 0d;
        double runnerValue = GetMetric(runnerUp, metric) ?? 0d;

        // winning metric: at least MinMargin better than the runner-up
        if (runnerValue <= 0 || (runnerValue - winnerValue) / runnerValue < MinMargin)
        {
            return null;
        }

        // other metric: not worse than the runner-up (both values required)
        Metric other = metric == Metric.Cost ? Metric.Latency : Metric.Cost;
        double? winnerOther = GetMetric(winner, other);
        double? runnerOther = GetMetric(runnerUp, other);
        if (!winnerOther.HasValue || !runnerOther.HasValue || winnerOther.Value > runnerOther.Value)
        {
            return null;
        }

        // pass rate: not worse than the runner-up
        if (!winner.PassRate.HasValue || !runnerUp.PassRate.HasValue || winner.PassRate.Value < runnerUp.PassRate.Value)
        {
            return null;
        }

        double? currentValue = GetMetric(currentStats, metric);
        double relativeSaving = currentValue is > 0
            ? (currentValue.Value - winnerValue) / currentValue.Value
            : double.MinValue;

        return new Candidate(winner, metric, relativeSaving);
    }

    private static double? GetMetric(TestRunStats stats, Metric metric) => metric switch
    {
        Metric.Cost => stats.Cost.HasValue ? (double)stats.Cost.Value : null,
        Metric.Latency => stats.TotalDuration?.TotalMilliseconds,
        _ => null,
    };

    private static string FormatMetric(Metric metric, TestRunStats stats) 
        => metric switch
        {
            Metric.Cost => stats.Cost?.ToString("0.####") ?? "?",
            Metric.Latency => stats.TotalDuration.HasValue
                ? $"{stats.TotalDuration.Value.TotalSeconds:F2}s"
                : "?",
            _ => "?",
        };

    private enum Metric
    {
        Cost,
        Latency,
    }

    private sealed record Candidate(TestRunStats Winner, Metric Metric, double RelativeSaving);
}
