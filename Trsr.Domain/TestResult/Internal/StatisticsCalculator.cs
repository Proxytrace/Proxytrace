using Trsr.Domain.Evaluation;
using Trsr.Domain.TestResult;

namespace Trsr.Domain.TestResult.Internal;

internal class StatisticsCalculator : IStatisticsCalculator
{
    public TestResultStatistics CalculateStatistics(ITestResult testRun) 
        => new(
            InputTokens: testRun.Statistics.InputTokens,
            OutputTokens: testRun.Statistics.OutputTokens,
            Duration: testRun.Statistics.Duration);
}