using Trsr.Domain.Usage;

namespace Trsr.Application.Statistics.TestRun;

/// <summary>
/// Per-run projection. One row per finalized <c>ITestRun</c>.
/// </summary>
public record TestRunStats(
    Guid TestRunId,
    Guid AgentId,
    Guid EndpointId,
    Guid GroupId,
    Guid SuiteId,
    int TestCases,
    int Passed,
    TimeSpan? TotalDuration,
    TokenUsage? Usage,
    decimal? Cost,
    DateTimeOffset RunCompletedAt) : IStats
{
    public int Failed => TestCases - Passed;

    public double? PassRate
        => TestCases > 0 ? Passed / (double)TestCases : null;
    
    public record Filter(
        Guid? AgentId = null,
        Guid? EndpointId = null,
        Guid? GroupId = null,
        Guid? SuiteId = null,
        DateTimeOffset? From = null,
        DateTimeOffset? To = null);
}