using Proxytrace.Application.Statistics.TestRun;
using Proxytrace.Domain;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.AgentCall;
using Proxytrace.Domain.OptimizationProposal;
using Proxytrace.Domain.TestSuite;

namespace Proxytrace.Application.Statistics.Internal;

internal class StatisticsService : IStatisticsService
{
    private readonly IStatsReader<TestRunStats, TestRunStats.Filter> runStats;
    private readonly IAgentCallStatsReader callStats;
    private readonly IEvaluatorStatsReader evaluatorStats;
    private readonly IRepository<IAgent> agents;
    private readonly IAgentCallRepository agentCalls;
    private readonly IRepository<ITestSuite> testSuites;
    private readonly IRepository<IOptimizationProposal> proposals;

    public StatisticsService(
        IStatsReader<TestRunStats, TestRunStats.Filter> runStats,
        IAgentCallStatsReader callStats,
        IEvaluatorStatsReader evaluatorStats,
        IRepository<IAgent> agents,
        IAgentCallRepository agentCalls,
        IRepository<ITestSuite> testSuites,
        IRepository<IOptimizationProposal> proposals)
    {
        this.runStats = runStats;
        this.callStats = callStats;
        this.evaluatorStats = evaluatorStats;
        this.agents = agents;
        this.agentCalls = agentCalls;
        this.testSuites = testSuites;
        this.proposals = proposals;
    }

    public async Task<DashboardView> GetDashboardViewAsync(StatisticsFilter filter, int recentTraceCount, int agentLimit, CancellationToken cancellationToken = default)
    {
        Task<StatisticsSummary> summaryTask = GetSummaryAsync(filter, cancellationToken);
        Task<LiveTelemetry> telemetryTask = GetLiveTelemetryAsync(filter, cancellationToken);
        Task<DashboardTrends> trendsTask = GetDashboardTrendsAsync(filter, cancellationToken);
        Task<IReadOnlyList<AgentBreakdownStat>> agentBreakdownTask = GetAgentBreakdownAsync(filter, cancellationToken);
        Task<IReadOnlyList<LatencyStat>> latencyTask = GetLatencyAsync(filter, cancellationToken);
        Task<IReadOnlyList<ModelBreakdownStat>> modelBreakdownTask = GetModelBreakdownAsync(filter, cancellationToken);
        Task<IReadOnlyList<TokenUsageStat>> tokenUsageTask = GetTokenUsageAsync(filter, cancellationToken);
        Task<IReadOnlyList<AgentTokenUsageStat>> tokenByAgentTask = GetTokenUsageByAgentAsync(filter, cancellationToken);
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
            RecentTraces: recentTask.Result.Items,
            Agents: topAgents,
            AgentLastCallTimes: lastCallTimes);
    }

    public async Task<StatisticsSummary> GetSummaryAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
    {
        StatisticsSummary callSummary = await callStats.GetSummaryAsync(filter, cancellationToken);
        TestRunStats.Filter runFilter = await ToRunFilterAsync(filter, cancellationToken);
        IReadOnlyList<TestRunStats> runs = await runStats.QueryAsync(runFilter, cancellationToken);

        int totalCases = runs.Sum(r => r.TestCases);
        int totalPassed = runs.Sum(r => r.Passed);
        double? passRate = totalCases > 0 ? totalPassed / (double)totalCases : null;

        return callSummary with { OverallPassRate = passRate };
    }

    public Task<IReadOnlyList<TokenUsageStat>> GetTokenUsageAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
        => callStats.GetTokenUsageAsync(filter, cancellationToken);

    public Task<IReadOnlyList<LatencyStat>> GetLatencyAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
        => callStats.GetLatencyAsync(filter, cancellationToken);

    public Task<IReadOnlyList<ErrorRateStat>> GetErrorRatesAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
        => callStats.GetErrorRatesAsync(filter, cancellationToken);

    public Task<IReadOnlyList<ModelBreakdownStat>> GetModelBreakdownAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
        => callStats.GetModelBreakdownAsync(filter, cancellationToken);

    public Task<IReadOnlyList<AgentBreakdownStat>> GetAgentBreakdownAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
        => callStats.GetAgentBreakdownAsync(filter, cancellationToken);

    public Task<IReadOnlyList<CostEstimateStat>> GetCostEstimateAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
        => callStats.GetCostEstimateAsync(filter, cancellationToken);

    public async Task<LiveTelemetry> GetLiveTelemetryAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
    {
        DateTimeOffset now = DateTimeOffset.UtcNow;
        LiveTelemetry traffic = await callStats.GetLiveTelemetryAsync(filter, now.AddMinutes(-5), now, cancellationToken);
        string version = typeof(StatisticsService).Assembly.GetName().Version?.ToString(3) ?? "0.0.0";
        return traffic with { ProxyVersion = "v" + version };
    }

    public Task<IReadOnlyList<AgentTokenUsageStat>> GetTokenUsageByAgentAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
        => callStats.GetTokenUsageByAgentAsync(filter, cancellationToken);

    public async Task<DashboardTrends> GetDashboardTrendsAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
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

    public Task<IReadOnlyList<AgentTimeSeriesPoint>> GetAgentTimeSeriesAsync(Guid agentId, DateTimeOffset from, DateTimeOffset to, StatisticsBucket bucket, CancellationToken cancellationToken = default)
        => callStats.GetAgentTimeSeriesAsync(agentId, from, to, bucket, cancellationToken);

    public async Task<IReadOnlyList<PassRateStat>> GetPassRatesAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
    {
        TestRunStats.Filter runFilter = await ToRunFilterAsync(filter, cancellationToken);
        IReadOnlyList<TestRunStats> rows = await runStats.QueryAsync(runFilter, cancellationToken);

        return rows
            .OrderByDescending(r => r.RunCompletedAt)
            .Select(r => new PassRateStat(
                SuiteId: r.SuiteId,
                RunTimestamp: r.RunCompletedAt,
                PassCount: r.Passed,
                FailCount: r.Failed))
            .ToArray();
    }

    public async Task<AgentOverviewStat> GetAgentOverviewAsync(Guid agentId, DateTimeOffset from, DateTimeOffset to, StatisticsBucket bucket, CancellationToken cancellationToken = default)
    {
        Task<(IReadOnlyList<AgentTimeSeriesPoint> Series, AgentTimeSummary Summary)> windowTask
            = callStats.GetAgentWindowAsync(agentId, from, to, bucket, cancellationToken);
        Task<IReadOnlyList<AgentPassRatePoint>> passRateTask = GetAgentPassRateTrendAsync(agentId, from, to, bucket, cancellationToken);
        Task<IReadOnlyList<AgentSuitePassRate>> suitesTask = GetAgentLatestSuitePassRatesAsync(agentId, cancellationToken);
        Task<AgentEntityCounts> countsTask = GetAgentEntityCountsAsync(agentId, cancellationToken);

        await Task.WhenAll(windowTask, passRateTask, suitesTask, countsTask);

        (IReadOnlyList<AgentTimeSeriesPoint> series, AgentTimeSummary summary) = windowTask.Result;

        return new AgentOverviewStat(
            Summary: summary,
            TimeSeries: series,
            PassRateTrend: passRateTask.Result,
            SuitePassRates: suitesTask.Result,
            Counts: countsTask.Result);
    }

    public async Task<IReadOnlyList<AgentPassRatePoint>> GetAgentPassRateTrendAsync(Guid agentId, DateTimeOffset from, DateTimeOffset to, StatisticsBucket bucket, CancellationToken cancellationToken = default)
    {
        IReadOnlyList<TestRunStats> rows = await runStats.QueryAsync(
            new TestRunStats.Filter(AgentId: agentId, From: from, To: to),
            cancellationToken);

        return rows
            .GroupBy(r => bucket.BucketStart(r.RunCompletedAt))
            .OrderBy(g => g.Key)
            .Select(g => new AgentPassRatePoint(
                BucketStart: g.Key,
                Passed: g.Sum(r => r.Passed),
                TestCases: g.Sum(r => r.TestCases)))
            .ToArray();
    }

    public async Task<IReadOnlyList<AgentSuitePassRate>> GetAgentLatestSuitePassRatesAsync(Guid agentId, CancellationToken cancellationToken = default)
    {
        IReadOnlyList<TestRunStats> rows = await runStats.QueryAsync(new TestRunStats.Filter(AgentId: agentId), cancellationToken);

        TestRunStats[] latestPerSuite = rows
            .GroupBy(r => r.SuiteId)
            .Select(g => g.OrderByDescending(r => r.RunCompletedAt).First())
            .ToArray();

        if (latestPerSuite.Length == 0)
        {
            return [];
        }

        Guid[] suiteIds = latestPerSuite.Select(r => r.SuiteId).ToArray();
        IReadOnlyList<ITestSuite> suites;
        try
        {
            suites = await testSuites.GetManyAsync(suiteIds, cancellationToken);
        }
        catch (Domain.Exceptions.EntitiesNotFoundException)
        {
            // Some suites were deleted after the run finalized — fall back to a per-id lookup.
            var found = new List<ITestSuite>(suiteIds.Length);
            foreach (Guid id in suiteIds)
            {
                ITestSuite? suite = await testSuites.FindAsync(id, cancellationToken);
                if (suite is not null)
                {
                    found.Add(suite);
                }
            }
            suites = found;
        }

        Dictionary<Guid, ITestSuite> suiteById = suites.ToDictionary(s => s.Id);

        return latestPerSuite
            .Where(r => suiteById.ContainsKey(r.SuiteId))
            .Select(r =>
            {
                ITestSuite suite = suiteById[r.SuiteId];
                return new AgentSuitePassRate(
                    SuiteId: suite.Id,
                    SuiteName: suite.Name,
                    LatestRunAt: r.RunCompletedAt,
                    Passed: r.Passed,
                    TestCases: r.TestCases);
            })
            .ToArray();
    }

    public async Task<AgentEntityCounts> GetAgentEntityCountsAsync(Guid agentId, CancellationToken cancellationToken = default)
    {
        // Repositories don't expose filtered queries; load and filter. Suite/proposal volumes
        // per project are typically small, but if this becomes hot, push filters into the repo layer.
        IReadOnlyList<ITestSuite> allSuites = await testSuites.GetAllAsync(cancellationToken);
        ITestSuite[] agentSuites = allSuites.Where(s => s.Agent.Id == agentId).ToArray();

        IReadOnlyList<IOptimizationProposal> allProposals = await proposals.GetAllAsync(cancellationToken);
        IOptimizationProposal[] agentProposals = allProposals.Where(p => p.Agent.Id == agentId).ToArray();

        return new AgentEntityCounts(
            SuiteCount: agentSuites.Length,
            TestCaseCount: agentSuites.Sum(s => s.TestCases.Count),
            OpenProposalCount: agentProposals.Count(p => p.Status == ProposalStatus.Draft),
            TotalProposalCount: agentProposals.Length);
    }

    public Task<EvaluatorOverviewStat> GetEvaluatorOverviewAsync(Guid evaluatorId, DateTimeOffset from, DateTimeOffset to, StatisticsBucket bucket, CancellationToken cancellationToken = default)
        => evaluatorStats.GetOverviewAsync(evaluatorId, from, to, bucket, cancellationToken);

    public Task<IReadOnlyList<EvaluatorSparklineStat>> GetEvaluatorSparklinesAsync(Guid projectId, DateTimeOffset from, DateTimeOffset to, StatisticsBucket bucket, CancellationToken cancellationToken = default)
        => evaluatorStats.GetSparklinesAsync(projectId, from, to, bucket, cancellationToken);

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
