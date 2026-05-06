namespace Trsr.Domain.TestRun.Internal;

internal interface IStatisticsCalculator
{
    TestRunStatistics CalculateStatistics(ITestRun testRun);
}