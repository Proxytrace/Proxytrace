using Trsr.Domain.Evaluation;
using Trsr.Domain.TestResult;

namespace Trsr.Domain.TestRun.Internal;

internal class StatisticsCalculator : IStatisticsCalculator
{
    public TestRunStatistics CalculateStatistics(ITestRun testRun)
    {
        IReadOnlyList<ITestResult> results = testRun.TestResults;
        long inputTokens = results.Sum(r => r.Statistics.InputTokens);
        long outputTokens = results.Sum(r => r.Statistics.OutputTokens);

        decimal? cost = null;
        if (testRun.Endpoint is { InputTokenCost: not null, OutputTokenCost: not null })
        {
            cost = Math.Round(
                inputTokens / 1_000_000m * testRun.Endpoint.InputTokenCost.Value +
                outputTokens / 1_000_000m * testRun.Endpoint.OutputTokenCost.Value,
                6);
        }

        return new TestRunStatistics(
            TestCases: results.Count,
            Passed: results.Count(r =>
                r.Evaluations.Count > 0 &&
                r.Evaluations.All(e => e.Score >= EvaluationScore.Acceptable)),
            InputTokens: inputTokens,
            OutputTokens: outputTokens,
            TotalDuration: results
                .Select(r => r.Statistics.Duration)
                .Aggregate(TimeSpan.Zero, (a, b) => a + b),
            Cost: cost);
    }
}