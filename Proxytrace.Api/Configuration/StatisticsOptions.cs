namespace Proxytrace.Api.Configuration;

/// <summary>
/// Default and maximum page sizes for the dashboard statistics endpoint.
/// </summary>
public sealed record StatisticsOptions
{
    public int DefaultRecentTraceCount { get; init; } = 6;
    public int MaxRecentTraceCount { get; init; } = 50;
    public int DefaultAgentLimit { get; init; } = 10;
    public int MaxAgentLimit { get; init; } = 100;

    public void Validate()
    {
        if (DefaultRecentTraceCount < 1 || DefaultRecentTraceCount > MaxRecentTraceCount)
        {
            throw new InvalidOperationException(
                $"{nameof(StatisticsOptions)}: {nameof(DefaultRecentTraceCount)} must be >= 1 and <= {nameof(MaxRecentTraceCount)}.");
        }

        if (DefaultAgentLimit < 1 || DefaultAgentLimit > MaxAgentLimit)
        {
            throw new InvalidOperationException(
                $"{nameof(StatisticsOptions)}: {nameof(DefaultAgentLimit)} must be >= 1 and <= {nameof(MaxAgentLimit)}.");
        }
    }
}
