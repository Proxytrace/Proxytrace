using Proxytrace.Application.Statistics.TestRun;
using Proxytrace.Domain;
using Proxytrace.Domain.Exceptions;
using Proxytrace.Domain.OptimizationProposal;
using Proxytrace.Domain.TestSuite;

namespace Proxytrace.Application.Statistics.Internal;

internal class AgentStatistics : IAgentStatistics
{
    private readonly IStatsReader<TestRunStats, TestRunStats.Filter> runStats;
    private readonly IAgentCallStatsReader callStats;
    private readonly IRepository<ITestSuite> testSuites;
    private readonly IRepository<IOptimizationProposal> proposals;

    public AgentStatistics(
        IStatsReader<TestRunStats, TestRunStats.Filter> runStats,
        IAgentCallStatsReader callStats,
        IRepository<ITestSuite> testSuites,
        IRepository<IOptimizationProposal> proposals)
    {
        this.runStats = runStats;
        this.callStats = callStats;
        this.testSuites = testSuites;
        this.proposals = proposals;
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

    internal async Task<IReadOnlyList<AgentPassRatePoint>> GetAgentPassRateTrendAsync(Guid agentId, DateTimeOffset from, DateTimeOffset to, StatisticsBucket bucket, CancellationToken cancellationToken = default)
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

    internal async Task<IReadOnlyList<AgentSuitePassRate>> GetAgentLatestSuitePassRatesAsync(Guid agentId, CancellationToken cancellationToken = default)
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
        catch (EntitiesNotFoundException)
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

    internal async Task<AgentEntityCounts> GetAgentEntityCountsAsync(Guid agentId, CancellationToken cancellationToken = default)
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
}
