namespace Proxytrace.Application.Statistics;

/// <summary>
/// Read facade for the main dashboard and the traces overview. Consumed by
/// <c>StatisticsController</c> (dashboard) and <c>AgentCallsController</c> (traces overview).
/// </summary>
public interface IDashboardStatistics
{
    /// <summary>
    /// Composes the entire dashboard payload in a single call by fanning out to the granular
    /// statistics readers in parallel. Replaces the client's per-widget request waterfall.
    /// </summary>
    Task<DashboardView> GetDashboardViewAsync(StatisticsFilter filter, int recentTraceCount, int agentLimit, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AgentBreakdownStat>> GetAgentBreakdownAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<LatencyStat>> GetLatencyAsync(StatisticsFilter filter, CancellationToken cancellationToken = default);
}
