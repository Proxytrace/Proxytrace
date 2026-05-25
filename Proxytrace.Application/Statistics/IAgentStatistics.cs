namespace Proxytrace.Application.Statistics;

/// <summary>
/// Read facade for the per-agent overview page. Consumed by <c>StatisticsController</c>.
/// </summary>
public interface IAgentStatistics
{
    Task<AgentOverviewStat> GetAgentOverviewAsync(Guid agentId, DateTimeOffset from, DateTimeOffset to, StatisticsBucket bucket, CancellationToken cancellationToken = default);
}
