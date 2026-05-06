using Trsr.Domain.Usage;

namespace Trsr.Domain.TestRun;

public record TestRunStatistics(
    int TestCases,
    int Passed,
    TokenUsage? Usage,
    TimeSpan? Latency,
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
            Latency: TimeSpan.Zero, 
            Cost: null);
    
    public static TestRunStatistics operator -(TestRunStatistics a, TestRunStatistics b) =>
        new(
            TestCases: a.TestCases - b.TestCases,
            Passed: a.Passed - b.Passed,
            Usage: a.Usage != null && b.Usage != null ? a.Usage - b.Usage : null,
            Latency: a.Latency.HasValue && b.Latency.HasValue ? a.Latency.Value - b.Latency.Value : null,
            Cost: a.Cost.HasValue && b.Cost.HasValue ? a.Cost.Value - b.Cost.Value : null);
}
