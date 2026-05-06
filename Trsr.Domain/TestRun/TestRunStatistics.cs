namespace Trsr.Domain.TestRun;

public record TestRunStatistics(
    int TestCases,
    int Passed,
    long InputTokens,
    long OutputTokens,
    TimeSpan TotalDuration,
    decimal? Cost)
{
    public int Failed
        => TestCases - Passed;
    
    public double PassRate 
        => Passed / (double)TestCases;
    
    public static TestRunStatistics Empty
        => new(0, 0, 0, 0, TimeSpan.Zero, null);
}
