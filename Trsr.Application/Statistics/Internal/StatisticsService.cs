using Trsr.Domain;
using Trsr.Domain.OptimizationProposal;
using Trsr.Domain.TestCase;
using Trsr.Domain.TestSuite;

namespace Trsr.Application.Statistics.Internal;

internal class StatisticsService : IStatisticsService
{
    private readonly ITestRunStatsStore runStatsStore;
    private readonly IAgentCallStatsQueries callStats;
    private readonly IRepository<ITestSuite> testSuites;
    private readonly IRepository<ITestCase> testCases;
    private readonly IRepository<IOptimizationProposal> proposals;

    public StatisticsService(
        ITestRunStatsStore runStatsStore,
        IAgentCallStatsQueries callStats,
        IRepository<ITestSuite> testSuites,
        IRepository<ITestCase> testCases,
        IRepository<IOptimizationProposal> proposals)
    {
        this.runStatsStore = runStatsStore;
        this.callStats = callStats;
        this.testSuites = testSuites;
        this.testCases = testCases;
        this.proposals = proposals;
    }

    public Task<StatisticsSummary> GetSummaryAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
        => callStats.GetSummaryAsync(filter, cancellationToken);

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

    public async Task<IReadOnlyList<PassRateStat>> GetPassRatesAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
    {
        TestRunStatsFilter f = new(
            AgentId: filter.AgentId,
            EndpointId: filter.EndpointId,
            From: filter.From,
            To: filter.To);

        IReadOnlyList<TestRunStats> rows = await runStatsStore.QueryAsync(f, cancellationToken);

        return rows
            .OrderByDescending(r => r.RunCompletedAt)
            .Select(r => new PassRateStat(
                SuiteId: r.SuiteId,
                RunTimestamp: r.RunCompletedAt,
                PassCount: r.Passed,
                FailCount: r.Failed,
                UndecidedCount: 0))
            .ToArray();
    }

    public Task<TestRunStats?> GetTestRunStatsAsync(Guid testRunId, CancellationToken cancellationToken = default)
        => runStatsStore.GetByTestRunIdAsync(testRunId, cancellationToken);

    public Task<IReadOnlyList<TestRunStats>> GetTestRunStatsByGroupAsync(Guid groupId, CancellationToken cancellationToken = default)
        => runStatsStore.QueryAsync(new TestRunStatsFilter(GroupId: groupId), cancellationToken);

    public async Task<TestRunStatsAggregate> GetStatisticsByGroupAsync(Guid groupId, CancellationToken cancellationToken = default)
    {
        IReadOnlyList<TestRunStats> rows = await runStatsStore.QueryAsync(new TestRunStatsFilter(GroupId: groupId), cancellationToken);
        return Aggregate(rows);
    }

    public async Task<TestRunStatsAggregate> GetStatisticsByAgentAsync(Guid agentId, CancellationToken cancellationToken = default)
    {
        IReadOnlyList<TestRunStats> rows = await runStatsStore.QueryAsync(new TestRunStatsFilter(AgentId: agentId), cancellationToken);
        return Aggregate(rows);
    }

    public async Task<TestRunStatsAggregate> GetStatisticsAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
    {
        TestRunStatsFilter f = new(
            AgentId: filter.AgentId,
            EndpointId: filter.EndpointId,
            From: filter.From,
            To: filter.To);
        IReadOnlyList<TestRunStats> rows = await runStatsStore.QueryAsync(f, cancellationToken);
        return Aggregate(rows);
    }

    public async Task<AgentOverviewStat> GetAgentOverviewAsync(Guid agentId, DateTimeOffset from, DateTimeOffset to, StatisticsBucket bucket, CancellationToken cancellationToken = default)
    {
        Task<AgentTimeSummary> summaryTask = callStats.GetAgentTimeSummaryAsync(agentId, from, to, cancellationToken);
        Task<IReadOnlyList<AgentTimeSeriesPoint>> timeSeriesTask = callStats.GetAgentTimeSeriesAsync(agentId, from, to, bucket, cancellationToken);
        Task<IReadOnlyList<AgentPassRatePoint>> passRateTask = GetAgentPassRateTrendAsync(agentId, from, to, bucket, cancellationToken);
        Task<IReadOnlyList<AgentSuitePassRate>> suitesTask = GetAgentLatestSuitePassRatesAsync(agentId, cancellationToken);
        Task<AgentEntityCounts> countsTask = GetAgentEntityCountsAsync(agentId, cancellationToken);

        await Task.WhenAll(summaryTask, timeSeriesTask, passRateTask, suitesTask, countsTask);

        return new AgentOverviewStat(
            Summary: summaryTask.Result,
            TimeSeries: timeSeriesTask.Result,
            PassRateTrend: passRateTask.Result,
            SuitePassRates: suitesTask.Result,
            Counts: countsTask.Result);
    }

    public Task<IReadOnlyList<AgentTimeSeriesPoint>> GetAgentTimeSeriesAsync(Guid agentId, DateTimeOffset from, DateTimeOffset to, StatisticsBucket bucket, CancellationToken cancellationToken = default)
        => callStats.GetAgentTimeSeriesAsync(agentId, from, to, bucket, cancellationToken);

    public async Task<IReadOnlyList<AgentPassRatePoint>> GetAgentPassRateTrendAsync(Guid agentId, DateTimeOffset from, DateTimeOffset to, StatisticsBucket bucket, CancellationToken cancellationToken = default)
    {
        IReadOnlyList<TestRunStats> rows = await runStatsStore.QueryAsync(
            new TestRunStatsFilter(AgentId: agentId, From: from, To: to),
            cancellationToken);

        return rows
            .GroupBy(r => BucketStart(r.RunCompletedAt, bucket))
            .OrderBy(g => g.Key)
            .Select(g => new AgentPassRatePoint(
                BucketStart: g.Key,
                Passed: g.Sum(r => r.Passed),
                TestCases: g.Sum(r => r.TestCases)))
            .ToArray();
    }

    public async Task<IReadOnlyList<AgentSuitePassRate>> GetAgentLatestSuitePassRatesAsync(Guid agentId, CancellationToken cancellationToken = default)
    {
        IReadOnlyList<TestRunStats> rows = await runStatsStore.QueryAsync(new TestRunStatsFilter(AgentId: agentId), cancellationToken);

        var latestPerSuite = rows
            .GroupBy(r => r.SuiteId)
            .Select(g => g.OrderByDescending(r => r.RunCompletedAt).First())
            .ToArray();

        var result = new List<AgentSuitePassRate>(latestPerSuite.Length);
        foreach (TestRunStats row in latestPerSuite)
        {
            ITestSuite? suite = await testSuites.FindAsync(row.SuiteId, cancellationToken);
            if (suite is null)
            {
                continue;
            }

            result.Add(new AgentSuitePassRate(
                SuiteId: suite.Id,
                SuiteName: suite.Name,
                LatestRunAt: row.RunCompletedAt,
                Passed: row.Passed,
                TestCases: row.TestCases));
        }

        return result;
    }

    public async Task<AgentEntityCounts> GetAgentEntityCountsAsync(Guid agentId, CancellationToken cancellationToken = default)
    {
        IReadOnlyList<ITestSuite> allSuites = await testSuites.GetAllAsync(cancellationToken);
        ITestSuite[] agentSuites = allSuites.Where(s => s.Agent.Id == agentId).ToArray();

        int suiteCount = agentSuites.Length;
        int testCaseCount = agentSuites.Sum(s => s.TestCases.Count);

        IReadOnlyList<IOptimizationProposal> allProposals = await proposals.GetAllAsync(cancellationToken);
        IOptimizationProposal[] agentProposals = allProposals.Where(p => p.Agent.Id == agentId).ToArray();
        int totalProposals = agentProposals.Length;
        int openProposals = agentProposals.Count(p => p.Status == ProposalStatus.Draft);

        return new AgentEntityCounts(suiteCount, testCaseCount, openProposals, totalProposals);
    }

    private static TestRunStatsAggregate Aggregate(IReadOnlyList<TestRunStats> rows)
    {
        if (rows.Count == 0)
        {
            return TestRunStatsAggregate.Empty;
        }

        Domain.Usage.TokenUsage? usage = rows
            .Select(r => r.Usage)
            .Aggregate<Domain.Usage.TokenUsage?, Domain.Usage.TokenUsage?>(null, (acc, next) => acc is null ? next : acc + next);

        TimeSpan? duration = rows.Any(r => r.TotalDuration.HasValue)
            ? TimeSpan.FromTicks(rows.Where(r => r.TotalDuration.HasValue).Sum(r => r.TotalDuration?.Ticks ?? 0))
            : null;

        decimal? cost = rows.Any(r => r.Cost.HasValue)
            ? rows.Where(r => r.Cost.HasValue).Sum(r => r.Cost ?? 0)
            : null;

        return new TestRunStatsAggregate(
            TestCases: rows.Sum(r => r.TestCases),
            Passed: rows.Sum(r => r.Passed),
            TotalDuration: duration,
            Usage: usage,
            Cost: cost);
    }

    private static DateTimeOffset BucketStart(DateTimeOffset timestamp, StatisticsBucket bucket) => bucket switch
    {
        StatisticsBucket.FiveMinutes => new DateTimeOffset(
            timestamp.Year, timestamp.Month, timestamp.Day,
            timestamp.Hour, (timestamp.Minute / 5) * 5, 0, timestamp.Offset),
        StatisticsBucket.Hourly => new DateTimeOffset(
            timestamp.Year, timestamp.Month, timestamp.Day,
            timestamp.Hour, 0, 0, timestamp.Offset),
        StatisticsBucket.Daily => new DateTimeOffset(
            timestamp.Year, timestamp.Month, timestamp.Day, 0, 0, 0, timestamp.Offset),
        _ => timestamp,
    };
}
