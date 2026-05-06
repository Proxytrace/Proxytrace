namespace Trsr.Domain.TestResult.Internal;

internal interface IStatisticsCalculator
{
    TestResultStatistics CalculateStatistics(ITestResult testRun);
}