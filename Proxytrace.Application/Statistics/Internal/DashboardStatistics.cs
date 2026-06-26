using Proxytrace.Application.Statistics.TestRun;
using Proxytrace.Common.Hosting;
using Proxytrace.Domain;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.AgentCall;
using Proxytrace.Messaging;

namespace Proxytrace.Application.Statistics.Internal;

internal class DashboardStatistics : IDashboardStatistics
{
    private readonly IStatsReader<TestRunStats, TestRunStats.Filter> runStats;
    private readonly IAgentCallStatsReader callStats;
    private readonly IAgentRepository agents;
    private readonly IAgentCallRepository agentCalls;
    private readonly IIngestionStream ingestionStream;
    private readonly IAppVersion appVersion;

    public DashboardStatistics(
        IStatsReader<TestRunStats, TestRunStats.Filter> runStats,
        IAgentCallStatsReader callStats,
        IAgentRepository agents,
        IAgentCallRepository agentCalls,
        IIngestionStream ingestionStream,
        IAppVersion appVersion)
    {
        this.runStats = runStats;
        this.callStats = callStats;
        this.agents = agents;
        this.agentCalls = agentCalls;
        this.ingestionStream = ingestionStream;
        this.appVersion = appVersion;
    }

    public async Task<DashboardView> GetDashboardViewAsync(StatisticsFilter filter, int recentTraceCount, int agentLimit, CancellationToken cancellationToken = default)
    {
        // Every query below is independent and read-only. On a relational provider the awaits yield
        // on real database I/O, so a plain Task.WhenAll fan-out genuinely overlaps them. The kiosk
        // in-memory EF provider, however, executes queries synchronously (it never yields), which
        // silently collapses the fan-out into sequential execution and turns a sub-100ms dashboard
        // into a ~600ms one. Offloading each query to the thread pool restores the intended
        // concurrency there; on relational the extra hop is negligible. The reads run on fresh
        // per-call DbContexts (no ambient transaction on this path), so parallel execution is safe.
        Task<StatisticsSummary> summaryTask = Task.Run(() => GetSummaryAsync(filter, cancellationToken), cancellationToken);
        Task<LiveTelemetry> telemetryTask = Task.Run(() => GetLiveTelemetryAsync(filter, cancellationToken), cancellationToken);
        Task<DashboardTrends> trendsTask = Task.Run(() => GetDashboardTrendsAsync(filter, cancellationToken), cancellationToken);
        Task<IReadOnlyList<AgentBreakdownStat>> agentBreakdownTask = Task.Run(() => GetAgentBreakdownAsync(filter, cancellationToken), cancellationToken);
        Task<IReadOnlyList<LatencyStat>> latencyTask = Task.Run(() => GetLatencyAsync(filter, cancellationToken), cancellationToken);
        Task<IReadOnlyList<ModelBreakdownStat>> modelBreakdownTask = Task.Run(() => GetModelBreakdownAsync(filter, cancellationToken), cancellationToken);
        // The two token-volume queries need the resolved bucket width, so they await the bucket task
        // rather than blocking the fan-out on it up front.
        Task<StatisticsBucket> tokenBucketTask = Task.Run(() => ResolveTokenBucketAsync(filter, cancellationToken), cancellationToken);
        Task<IReadOnlyList<TokenUsageStat>> tokenUsageTask = Task.Run(async () => await GetTokenUsageAsync(filter, await tokenBucketTask, cancellationToken), cancellationToken);
        Task<IReadOnlyList<AgentTokenUsageStat>> tokenByAgentTask = Task.Run(async () => await GetTokenUsageByAgentAsync(filter, await tokenBucketTask, cancellationToken), cancellationToken);
        Task<(IReadOnlyList<IAgentCall> Items, int Total)> recentTask = Task.Run(() => agentCalls.GetFilteredAsync(
            new AgentCallFilter(ProjectId: filter.ProjectId, From: filter.From, IncludeSystemAgents: !filter.ExcludeSystemAgents),
            page: 1,
            pageSize: recentTraceCount,
            cancellationToken), cancellationToken);
        // Scope the agent load to the project when filtered, instead of loading every agent and
        // discarding the rest in memory. The unfiltered (global) dashboard still needs all agents.
        Task<IReadOnlyList<IAgent>> agentsTask = Task.Run(() => filter.ProjectId is { } projectId
            ? agents.GetByProjectAsync(projectId, cancellationToken)
            : agents.GetAllAsync(cancellationToken), cancellationToken);
        Task<IReadOnlyDictionary<Guid, DateTimeOffset>> lastCallTimesTask = Task.Run(() => agentCalls.GetLastCallTimesAsync(cancellationToken), cancellationToken);

        await Task.WhenAll(
            summaryTask, telemetryTask, trendsTask, agentBreakdownTask, latencyTask,
            modelBreakdownTask, tokenBucketTask, tokenUsageTask, tokenByAgentTask, recentTask, agentsTask, lastCallTimesTask);

        StatisticsBucket tokenBucket = tokenBucketTask.Result;

        IReadOnlyDictionary<Guid, DateTimeOffset> lastCallTimes = lastCallTimesTask.Result;
        IReadOnlyList<IAgent> topAgents = agentsTask.Result
            // The agent load isn't routed through the call-stats query, so drop system agents here too
            // when excluded, keeping the returned Agents list consistent with the filtered aggregates.
            .Where(a => !filter.ExcludeSystemAgents || !a.IsSystemAgent)
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
        long queueDepth = await ingestionStream.GetQueueDepthAsync(cancellationToken);
        return traffic with
        {
            ProxyVersion = "v" + appVersion.Version,
            QueueDepth = (int)Math.Min(queueDepth, int.MaxValue),
        };
    }

    internal async Task<DashboardTrends> GetDashboardTrendsAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
    {
        const int buckets = 20;
        DateTimeOffset to = filter.To ?? DateTimeOffset.UtcNow;
        DateTimeOffset from = filter.From ?? to.AddDays(-1);

        CallTrends trends = await callStats.GetCallTrendsAsync(filter, buckets, from, to, cancellationToken);

        TestRunStats.Filter runFilter = await ToRunFilterAsync(filter, cancellationToken);
        IReadOnlyList<TestRunStats> runs = await runStats.QueryAsync(runFilter, cancellationToken);
        // One sparkline point per (group, endpoint) cohort so sampled runs don't cluster N points.
        double[] passRate = runs
            .AggregateSamples()
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
            IReadOnlyList<IAgent> projectAgents = await agents.GetByProjectAsync(projectId, cancellationToken);
            agentIds = projectAgents.Select(a => a.Id).ToArray();
        }

        return new TestRunStats.Filter(
            AgentId: filter.AgentId,
            AgentIds: agentIds,
            EndpointId: filter.EndpointId,
            From: filter.From,
            To: filter.To);
    }
}
