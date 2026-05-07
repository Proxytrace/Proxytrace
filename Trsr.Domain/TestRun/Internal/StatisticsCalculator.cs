using Trsr.Domain.TestResult;
using Trsr.Domain.Usage;

namespace Trsr.Domain.TestRun.Internal;

internal class StatisticsCalculator : IStatisticsCalculator
{
    public TestRunStatistics CalculateStatistics(ITestRun testRun)
    {
        IReadOnlyList<ITestResult> results = testRun.TestResults;
        
        TokenUsage? usage = results.Select(x => x.Statistics.Usage)
            .Where(x => x != null)
            .Aggregate((TokenUsage?)null, (a, b) 
                => a == null || b == null ? a ?? b : a + b);

        decimal? cost = usage != null
            ? testRun.Endpoint.CalculateCost(usage) 
            : null;

        return new TestRunStatistics(
            TestCases: results.Count,
            Passed: results.Count(r => r.Passed),
            Usage: usage,
            Latency: results
                .Select(r => r.Statistics.Latency)
                .Aggregate(TimeSpan.Zero, (a, b) => a + b),
            Cost: cost);
    }
}