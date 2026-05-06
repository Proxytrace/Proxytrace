using Trsr.Domain.Usage;

namespace Trsr.Domain.TestRun;

public record TestRunStatistics(
    int TestCases,
    int Passed,
    TokenUsage? Usage,
    TimeSpan? TotalDuration,
    decimal? Cost)
{
    public int Failed
        => TestCases - Passed;
    
    public double? PassRate 
        => TestCases > 0 ? Passed / (double)TestCases : null;
    
    public static TestRunStatistics Empty
        => new(
            TestCases: 0,
            Passed: 0,
            Usage: null, 
            TotalDuration: TimeSpan.Zero, 
            Cost: null);
}
