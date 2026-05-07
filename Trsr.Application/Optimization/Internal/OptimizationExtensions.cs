using Trsr.Domain.Proposal;
using Trsr.Domain.TestRun;

namespace Trsr.Application.Optimization.Internal;

internal static class OptimizationExtensions
{
    public static Priority GetOptimizationPriority(this TestRunStatistics statistics)
    {
        if (statistics.TestCases <= 0)
        {
            return Priority.Low;
        }

        double failRate = statistics.Failed / (double)statistics.TestCases;
        return failRate switch
        {
            >= 0.50 => Priority.Critical,
            >= 0.25 => Priority.High,
            >= 0.10 => Priority.Medium,
            _ => Priority.Low,
        };
    }
}