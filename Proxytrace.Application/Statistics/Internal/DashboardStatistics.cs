using Proxytrace.Application.Statistics.TestRun;
using Proxytrace.Domain;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.AgentCall;

namespace Proxytrace.Application.Statistics.Internal;

internal class DashboardStatistics : IDashboardStatistics
{
    private readonly IStatsReader<TestRunStats, TestRunStats.Filter> runStats;
    private readonly IAgentCallStatsReader callStats;
    private readonly IRepository<IAgent> agents;
    private readonly IAgentCallRepository agentCalls;

    public DashboardStatistics(
        IStatsReader<TestRunStats, TestRunStats.Filter> runStats,
        IAgentCallStatsReader callStats,
        IRepository<IAgent> agents,
        IAgentCallRepository agentCalls)
    {
        this.runStats = runStats;
        this.callStats = callStats;
        this.agents = agents;
        this.agentCalls = agentCalls;
    }

    public async Task<DashboardView> GetDashboardViewAsync(StatisticsFilter filter, int recentTraceCount, int agentLimit, CancellationToken cancellationToken = default)
    {
        Task<StatisticsSummary> summaryTask = GetSummaryAsync(filter, cancellationToken);
        Task<LiveTelemetry> telemetryTask = GetLiveTelemetryAsync(filter, cancellationToken);
        Task<DashboardTrends> trendsTask = GetDashboardTrendsAsync(filter, cancellationToken);
        Task<IReadOnlyList<AgentBreakdownStat>> agentBreakdownTask = GetAgentBreakdownAsync(filter, cancellationToken);
        Task<IReadOnlyList<LatencyStat>> latencyTask = GetLatencyAsync(filter, cancellationToken);
        Task<IReadOnlyList<ModelBreakdownStat>> modelBreakdownTask = GetModelBreakdownAsync(filter, cancellationToken);
        StatisticsBucket tokenBucket = await ResolveTokenBucketAsync(filter, cancellationToken);
        Task<IReadOnlyList<TokenUsageStat>> tokenUsageTask = GetTokenUsageAsync(filter, tokenBucket, cancellationToken);
        Task<IReadOnlyList<AgentTokenUsageStat>> tokenByAgentTask = GetTokenUsageByAgentAsync(filter, tokenBucket, cancellationToken);
        Task<(IReadOnlyList<IAgentCall> Items, int Total)> recentTask = agentCalls.GetFilteredAsync(
            new AgentCallFilter(ProjectId: filter.ProjectId, From: filter.From),
            page: 1,
            pageSize: recentTraceCount,
            cancellationToken);
        Task<IReadOnlyList<IAgent>> agentsTask = agents.GetAllAsync(cancellationToken);
        Task<IReadOnlyDictionary<Guid, DateTimeOffset>> lastCallTimesTask = agentCalls.GetLastCallTimesAsync(cancellationToken);

        await Task.WhenAll(
            summaryTask, telemetryTask, trendsTask, agentBreakdownTask, latencyTask,
            modelBreakdownTask, tokenUsageTask, tokenByAgentTask, recentTask, agentsTask, lastCallTimesTask);

        IReadOnlyDictionary<Guid, DateTimeOffset> lastCallTimes = lastCallTimesTask.Result;
        IReadOnlyList<IAgent> topAgents = agentsTask.Result
            .Where(a => filter.ProjectId is not { } pid || a.Project.Id == pid)
            .OrderByDescending(a => lastCallTimes.TryGetValue(a.Id, out DateTimeOffset t) ? t : DateTimeOffset.MinValue)
            .ThenByDescending(a => a.UpdatedAt)
            .Take(agentLimit)
            .ToArray();

        return new DashboardView(
            Summary: summaryTask.Result,
            LiveTelemetry: telemetryTask.Result,
            Trends: trendsTask.Result,
            AgentBreakdown: agentBreakdownTask.Result,
            Latency: latencyTask.Result,
            ModelBreakdown: modelBreakdownTask.Result,
            TokenUsage: tokenUsageTask.Result,
            TokenUsageByAgent: tokenByAgentTask.Result,
            TokenBucket: tokenBucket,
            RecentTraces: recentTask.Result.Items,
            Agents: topAgents,
            AgentLastCallTimes: lastCallTimes);
    }

    public Task<IReadOnlyList<AgentBreakdownStat>> GetAgentBreakdownAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
        => callStats.GetAgentBreakdownAsync(filter, cancellationToken);

    public Task<IReadOnlyList<LatencyStat>> GetLatencyAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
        => callStats.GetLatencyAsync(filter, cancellationToken);

    internal async Task<StatisticsSummary> GetSummaryAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
    {
        StatisticsSummary callSummary = await callStats.GetSummaryAsync(filter, cancellationToken);
        TestRunStats.Filter runFilter = await ToRunFilterAsync(filter, cancellationToken);
        IReadOnlyList<TestRunStats> runs = await runStats.QueryAsync(runFilter, cancellationToken);

        int totalCases = runs.Sum(r => r.TestCases);
        int totalPassed = runs.Sum(r => r.Passed);
        double? passRate = totalCases > 0 ? totalPassed / (double)totalCases : null;

        return callSummary with { OverallPassRate = passRate };
    }

    internal Task<IReadOnlyList<TokenUsageStat>> GetTokenUsageAsync(StatisticsFilter filter, StatisticsBucket bucket, CancellationToken cancellationToken = default)
        => callStats.GetTokenUsageAsync(filter, bucket, cancellationToken);

    /// <summary>
    /// Derives the token-volume bucket width from the window so short ranges (1h/24h) resolve to
    /// sub-day buckets and still produce a multi-point series. The all-time view has no lower bound,
    /// so the window is measured from the earliest matching call instead — a few hours of history
    /// then renders at 5-minute/hourly resolution rather than collapsing into one daily bar.
    /// </summary>
    private async Task<StatisticsBucket> ResolveTokenBucketAsync(StatisticsFilter filter, CancellationToken cancellationToken)
    {
        DateTimeOffset to = filter.To ?? DateTimeOffset.UtcNow;
        DateTimeOffset? from = filter.From ?? await callStats.GetEarliestCallAsync(filter, cancellationToken);
        return from is null ? StatisticsBucket.Daily : StatisticsTime.ForWindow(from.Value, to);
    }

    internal Task<IReadOnlyList<ModelBreakdownStat>> GetModelBreakdownAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
        => callStats.GetModelBreakdownAsync(filter, cancellationToken);

    internal Task<IReadOnlyList<AgentTokenUsageStat>> GetTokenUsageByAgentAsync(StatisticsFilter filter, StatisticsBucket bucket, CancellationToken cancellationToken = default)
        => callStats.GetTokenUsageByAgentAsync(filter, bucket, cancellationToken);

    internal async Task<LiveTelemetry> GetLiveTelemetryAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
    {
        DateTimeOffset now = DateTimeOffset.UtcNow;
        LiveTelemetry traffic = await callStats.GetLiveTelemetryAsync(filter, now.AddMinutes(-5), now, cancellationToken);
        string version = typeof(DashboardStatistics).Assembly.GetName().Version?.ToString(3) ?? "0.0.0";
        return traffic with { ProxyVersion = "v" + version };
    }

    internal async Task<DashboardTrends> GetDashboardTrendsAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
    {
        const int buckets = 20;
        DateTimeOffset to = filter.To ?? DateTimeOffset.UtcNow;
        DateTimeOffset from = filter.From ?? to.AddDays(-1);

        CallTrends trends = await callStats.GetCallTrendsAsync(filter, buckets, from, to, cancellationToken);

        TestRunStats.Filter runFilter = await ToRunFilterAsync(filter, cancellationToken);
        IReadOnlyList<TestRunStats> runs = await runStats.QueryAsync(runFilter, cancellationToken);
        double[] passRate = runs
            .Where(r => r.TestCases > 0)
            .OrderBy(r => r.RunCompletedAt)
            .Select(r => r.Passed / (double)r.TestCases * 100d)
            .ToArray();

        return new DashboardTrends(trends.Traces, trends.LatencyMs, trends.Throughput, passRate);
    }

    private async Task<TestRunStats.Filter> ToRunFilterAsync(StatisticsFilter filter, CancellationToken cancellationToken)
    {
        IReadOnlyCollection<Guid>? agentIds = null;
        if (filter.ProjectId is { } projectId)
        {
            IReadOnlyList<IAgent> all = await agents.GetAllAsync(cancellationToken);
            agentIds = all.Where(a => a.Project.Id == projectId).Select(a => a.Id).ToArray();
        }

        return new TestRunStats.Filter(
            AgentId: filter.AgentId,
            AgentIds: agentIds,
            EndpointId: filter.EndpointId,
            From: filter.From,
            To: filter.To);
    }
}
