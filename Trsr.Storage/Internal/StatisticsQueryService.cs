using Microsoft.EntityFrameworkCore;
using Trsr.Common.Async;
using Trsr.Domain;
using Trsr.Domain.Evaluation;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.OptimizationProposal;
using Trsr.Domain.TestRun;
using Trsr.Domain.Usage;
using Trsr.Storage.Internal.Entities.AgentCall;
using Trsr.Storage.Internal.Entities.Agent;
using Trsr.Storage.Internal.Entities.Model;
using Trsr.Storage.Internal.Entities.ModelEndpoint;
using Trsr.Storage.Internal.Entities.OptimizationProposal;
using Trsr.Storage.Internal.Entities.TestRun;
using Trsr.Storage.Internal.Entities.TestResult;
using Trsr.Storage.Internal.Entities.TestRunGroup;
using Trsr.Storage.Internal.Entities.TestSuite;
using TestRunStatistics = Trsr.Domain.TestRunStatistics;

namespace Trsr.Storage.Internal;

internal class StatisticsQueryService : IStatisticsQueryService
{
    private readonly IRepository<IModelEndpoint> endpoints;
    private readonly Func<StorageDbContext> contextFactory;

    public StatisticsQueryService(
        IRepository<IModelEndpoint> endpoints,
        Func<StorageDbContext> contextFactory)
    {
        this.endpoints = endpoints;
        this.contextFactory = contextFactory;
    }

    public async Task<StatisticsSummary> GetSummaryAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
    {
        var context = contextFactory();
        var query = ApplyCallFilter(context.Set<AgentCallEntity>().AsNoTracking(), filter, context);

        var calls = await query
            .GroupBy(_ => 1)
            .Select(g => new
            {
                TotalCalls = g.Count(),
                TotalInputTokens = g.Sum(e => (long?)e.InputTokens),
                TotalOutputTokens = g.Sum(e => (long?)e.OutputTokens),
                AvgLatencyMs = g.Average(e => e.LatencyMs),
            })
            .FirstOrDefaultAsync(cancellationToken);

        double passRate = 0;
        var results = await context.Set<TestResultEntity>().AsNoTracking().ToListAsync(cancellationToken);
        if (results.Count > 0)
        {
            passRate = (double)results.Count(r => r.Evaluations.Count > 0 && r.Evaluations.All(e => e.Score >= EvaluationScore.Acceptable)) / results.Count;
        }

        return new StatisticsSummary(
            TotalCalls: calls?.TotalCalls ?? 0,
            TotalInputTokens: calls?.TotalInputTokens ?? 0,
            TotalOutputTokens: calls?.TotalOutputTokens ?? 0,
            AvgLatencyMs: calls?.AvgLatencyMs ?? 0,
            OverallPassRate: passRate);
    }

    public async Task<IReadOnlyList<TokenUsageStat>> GetTokenUsageAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
    {
        var context = contextFactory();
        var calls = await ApplyCallFilter(context.Set<AgentCallEntity>().AsNoTracking(), filter, context)
            .ToListAsync(cancellationToken);

        return calls
            .GroupBy(e => (Date: DateOnly.FromDateTime(e.CreatedAt.UtcDateTime.Date), e.EndpointId))
            .Select(g => new TokenUsageStat(
                Date: g.Key.Date,
                EndpointId: g.Key.EndpointId,
                InputTokens: g.Sum(e => (long?)e.InputTokens),
                OutputTokens: g.Sum(e => (long?)e.OutputTokens)))
            .OrderBy(s => s.Date)
            .ThenBy(s => s.EndpointId)
            .ToArray();
    }

    public async Task<IReadOnlyList<LatencyStat>> GetLatencyAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
    {
        var context = contextFactory();
        var calls = await ApplyCallFilter(context.Set<AgentCallEntity>().AsNoTracking(), filter, context)
            .ToListAsync(cancellationToken);

        return calls
            .GroupBy(e => e.EndpointId)
            .Select(g =>
            {
                var sorted = g
                    .Where(x => x.LatencyMs.HasValue)
                    .Select(e => e.LatencyMs ?? 0)
                    .OrderBy(x => x).ToArray();
                return new LatencyStat(
                    EndpointId: g.Key,
                    P50Ms: Percentile(sorted, 0.50),
                    P95Ms: Percentile(sorted, 0.95),
                    P99Ms: Percentile(sorted, 0.99),
                    MinMs: sorted.Length > 0 ? sorted[0] : 0,
                    MaxMs: sorted.Length > 0 ? sorted[^1] : 0,
                    SampleCount: sorted.Length);
            })
            .OrderBy(s => s.EndpointId)
            .ToArray();
    }

    public async Task<IReadOnlyList<PassRateStat>> GetPassRatesAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
    {
        var context = contextFactory();

        var agentQuery = context.Set<AgentEntity>().AsNoTracking();
        if (filter.ProjectId.HasValue)
            agentQuery = agentQuery.Where(a => a.Project == filter.ProjectId.Value);
        if (filter.AgentId.HasValue)
            agentQuery = agentQuery.Where(a => a.Id == filter.AgentId.Value);
        var agentIds = await agentQuery.Select(a => a.Id).ToListAsync(cancellationToken);

        var runRows = await context.Set<TestRunEntity>()
            .AsNoTracking()
            .Join(context.Set<TestRunGroupEntity>(),
                r => r.Group,
                g => g.Id,
                (r, g) => new { Run = r, Group = g })
            .Join(context.Set<TestSuiteEntity>(),
                x => x.Group.Suite,
                s => s.Id,
                (x, s) => new { x.Run, SuiteId = s.Id, SuiteAgent = s.Agent })
            .Where(x => agentIds.Contains(x.SuiteAgent))
            .Where(x => filter.From == null || x.Run.CreatedAt >= filter.From)
            .Where(x => filter.To == null || x.Run.CreatedAt <= filter.To)
            .Select(x => new { x.Run, x.SuiteId })
            .ToListAsync(cancellationToken);

        var resultIds = runRows.SelectMany(r => r.Run.TestResults).Distinct().ToList();
        var results = await context.Set<TestResultEntity>()
            .AsNoTracking()
            .Where(r => resultIds.Contains(r.Id))
            .ToListAsync(cancellationToken);

        var resultLookup = results.ToDictionary(r => r.Id);

        return runRows.Select(row =>
        {
            var runResults = row.Run.TestResults
                .Where(id => resultLookup.ContainsKey(id))
                .Select(id => resultLookup[id])
                .ToArray();

            return new PassRateStat(
                SuiteId: row.SuiteId,
                RunTimestamp: row.Run.CreatedAt,
                PassCount: runResults.Count(r => r.Evaluations.Count > 0 && r.Evaluations.All(e => e.Score >= EvaluationScore.Acceptable)),
                FailCount: runResults.Count(r => r.Evaluations.Count > 0 && r.Evaluations.Any(e => e.Score < EvaluationScore.Acceptable)),
                UndecidedCount: runResults.Count(r => r.Evaluations.Count == 0));
        })
        .OrderBy(s => s.RunTimestamp)
        .ToArray();
    }

    public async Task<IReadOnlyList<ErrorRateStat>> GetErrorRatesAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
    {
        var context = contextFactory();
        var calls = await ApplyCallFilter(context.Set<AgentCallEntity>().AsNoTracking(), filter, context)
            .ToListAsync(cancellationToken);

        return calls
            .GroupBy(e => e.EndpointId)
            .Select(g => new ErrorRateStat(
                EndpointId: g.Key,
                TotalCalls: g.Count(),
                ErrorCalls: g.Count(e => e.HttpStatus >= 400),
                ErrorRate: !g.Any() ? 0 : (double)g.Count(e => e.HttpStatus >= 400) / g.Count()))
            .OrderBy(s => s.EndpointId)
            .ToArray();
    }

    public async Task<IReadOnlyList<ModelBreakdownStat>> GetModelBreakdownAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
    {
        var context = contextFactory();
        var stats = await ApplyCallFilter(context.Set<AgentCallEntity>().AsNoTracking(), filter, context)
            .GroupBy(e => e.EndpointId)
            .Select(g => new
            {
                EndpointId = g.Key,
                CallCount = g.Count(),
                TotalInputTokens = g.Sum(e => (long?)e.InputTokens),
                TotalOutputTokens = g.Sum(e => (long?)e.OutputTokens),
                AvgDurationMs = g.Average(e => e.LatencyMs),
            })
            .ToListAsync(cancellationToken);

        var endpointIds = stats.Select(s => s.EndpointId).Distinct().ToList();
        var modelNames = await context.Set<ModelEndpointEntity>()
            .Where(me => endpointIds.Contains(me.Id))
            .Join(context.Set<ModelEntity>(),
                me => me.Model,
                m => m.Id,
                (me, m) => new { me.Id, m.Name })
            .ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);

        return stats
            .Select(s => new ModelBreakdownStat(
                EndpointId: s.EndpointId,
                ModelName: modelNames.GetValueOrDefault(s.EndpointId, "unknown"),
                CallCount: s.CallCount,
                TotalInputTokens: s.TotalInputTokens,
                TotalOutputTokens: s.TotalOutputTokens,
                AvgDurationMs: s.AvgDurationMs))
            .OrderByDescending(s => s.CallCount)
            .ToArray();
    }

    public async Task<IReadOnlyList<AgentBreakdownStat>> GetAgentBreakdownAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
    {
        var context = contextFactory();
        var rows = await ApplyCallFilter(context.Set<AgentCallEntity>().AsNoTracking(), filter, context)
            .GroupBy(e => e.AgentId)
            .Select(g => new { AgentId = g.Key, CallCount = g.Count() })
            .ToListAsync(cancellationToken);

        return rows
            .Select(r => new AgentBreakdownStat(r.AgentId, r.CallCount))
            .OrderByDescending(s => s.CallCount)
            .ToArray();
    }

    public async Task<IReadOnlyList<CostEstimateStat>> GetCostEstimateAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
    {
        IReadOnlyList<ModelBreakdownStat> breakdown = await GetModelBreakdownAsync(filter, cancellationToken);

        return await breakdown.Select(async b =>
        {
            var endpoint = await endpoints.GetAsync(b.EndpointId, cancellationToken);
            var inputCost = endpoint.InputTokenCost.HasValue
                ? b.TotalInputTokens / 1_000_000m * endpoint.InputTokenCost.Value
                : null;
            var outputCost = endpoint.OutputTokenCost.HasValue
                ? b.TotalOutputTokens / 1_000_000m * endpoint.OutputTokenCost.Value
                : null;

            return new CostEstimateStat(
                EndpointId: b.EndpointId,
                InputCostEur: inputCost.HasValue ? Math.Round(inputCost.Value, 4) : null,
                OutputCostEur: outputCost.HasValue ? Math.Round(outputCost.Value, 4) : null,
                TotalCostEur: inputCost.HasValue && outputCost.HasValue ? Math.Round(inputCost.Value + outputCost.Value, 4) : null);
        })
        .Await()
        .ContinueWith(x => x.Result.ToList(), cancellationToken);
    }

    private static IQueryable<AgentCallEntity> ApplyCallFilter(
        IQueryable<AgentCallEntity> query,
        StatisticsFilter filter,
        StorageDbContext context)
    {
        if (filter.AgentId.HasValue)
            query = query.Where(e => e.AgentId == filter.AgentId.Value);

        if (filter.ProjectId.HasValue)
        {
            var projectId = filter.ProjectId.Value;
            query = query.Where(e => context.Set<AgentEntity>()
                    .Where(a => a.Project == projectId)
                    .Select(a => (Guid?)a.Id)
                    .Contains(e.AgentId));
        }

        if (filter.EndpointId is not null)
            query = query.Where(e => e.EndpointId == filter.EndpointId);

        if (filter.From.HasValue)
            query = query.Where(e => e.CreatedAt >= filter.From.Value);

        if (filter.To.HasValue)
            query = query.Where(e => e.CreatedAt <= filter.To.Value);

        return query;
    }

    public async Task<TestRunStatistics> GetStatisticsByGroupAsync(Guid groupId, CancellationToken cancellationToken = default)
    {
        return await AggregateKpi(
            contextFactory().Set<TestRunEntity>().AsNoTracking().Where(r => r.Group == groupId),
            cancellationToken);
    }

    public async Task<TestRunStatistics> GetStatisticsByAgentAsync(Guid agentId, CancellationToken cancellationToken = default)
    {
        var context = contextFactory();

        var suiteIds = await context.Set<TestSuiteEntity>().AsNoTracking()
            .Where(s => s.Agent == agentId)
            .Select(s => s.Id)
            .ToListAsync(cancellationToken);

        var groupIds = await context.Set<TestRunGroupEntity>().AsNoTracking()
            .Where(g => suiteIds.Contains(g.Suite))
            .Select(g => g.Id)
            .ToListAsync(cancellationToken);

        return await AggregateKpi(
            context.Set<TestRunEntity>().AsNoTracking().Where(r => groupIds.Contains(r.Group)),
            cancellationToken);
    }

    public async Task<TestRunStatistics> GetStatisticsAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
    {
        var context = contextFactory();
        var query = context.Set<TestRunEntity>().AsNoTracking();

        if (filter.From.HasValue)
            query = query.Where(r => r.CompletedAt >= filter.From.Value);
        if (filter.To.HasValue)
            query = query.Where(r => r.CompletedAt <= filter.To.Value);

        if (filter.AgentId.HasValue || filter.ProjectId.HasValue)
        {
            var agentQuery = context.Set<AgentEntity>().AsNoTracking();
            if (filter.AgentId.HasValue)
                agentQuery = agentQuery.Where(a => a.Id == filter.AgentId.Value);
            if (filter.ProjectId.HasValue)
                agentQuery = agentQuery.Where(a => a.Project == filter.ProjectId.Value);

            var agentIds = await agentQuery.Select(a => a.Id).ToListAsync(cancellationToken);

            var suiteIds = await context.Set<TestSuiteEntity>().AsNoTracking()
                .Where(s => agentIds.Contains(s.Agent))
                .Select(s => s.Id)
                .ToListAsync(cancellationToken);

            var groupIds = await context.Set<TestRunGroupEntity>().AsNoTracking()
                .Where(g => suiteIds.Contains(g.Suite))
                .Select(g => g.Id)
                .ToListAsync(cancellationToken);

            query = query.Where(r => groupIds.Contains(r.Group));
        }

        return await AggregateKpi(query, cancellationToken);
    }

    private static async Task<TestRunStatistics> AggregateKpi(
        IQueryable<TestRunEntity> query,
        CancellationToken cancellationToken)
    {
        var totals = await query
            .GroupBy(_ => 1)
            .Select(g => new
            {
                TestCases = g.Sum(r => r.StatTestCases),
                Passed = g.Sum(r => r.StatPassed),
                TotalDurationMs = g.Sum(r => r.StatTotalDurationMs),
                TotalInputTokens = g.Sum(r => r.StatInputTokens),
                TotalOutputTokens = g.Sum(r => r.StatOutputTokens),
                TotalCost = (decimal?)g.Sum(r => (double?)r.StatCost),
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (totals is null)
            return TestRunStatistics.Empty;

        return new TestRunStatistics(
            TestCases: totals.TestCases,
            Passed: totals.Passed,
            TotalDuration: totals.TotalDurationMs.HasValue 
                ? TimeSpan.FromMilliseconds(totals.TotalDurationMs.Value) 
                : null,
            TotalUsage: totals is {TotalInputTokens: not null, TotalOutputTokens: not null } 
                ? new TokenUsage((ulong)totals.TotalInputTokens.Value, (ulong)totals.TotalOutputTokens.Value) 
                : null,
            TotalCost: totals.TotalCost.HasValue
                ? Math.Round(totals.TotalCost.Value, 4) 
                : null);
    }

    private static double Percentile(double[] sorted, double percentile)
    {
        if (sorted.Length == 0) return 0;
        var index = percentile * (sorted.Length - 1);
        var lower = (int)Math.Floor(index);
        var upper = Math.Min(lower + 1, sorted.Length - 1);
        var fraction = index - lower;
        return sorted[lower] + fraction * (sorted[upper] - sorted[lower]);
    }

    public async Task<AgentOverviewStat> GetAgentOverviewAsync(
        Guid agentId,
        DateTimeOffset from,
        DateTimeOffset to,
        StatisticsBucket bucket,
        CancellationToken cancellationToken = default)
    {
        var (calls, endpointMap) = await LoadAgentCallsAsync(agentId, from, to, cancellationToken);
        var timeSeries = BucketCalls(calls, endpointMap, from, to, bucket);
        var summary = SummarizeCalls(calls, endpointMap);

        var passRateTask = GetAgentPassRateTrendAsync(agentId, from, to, bucket, cancellationToken);
        var suitePassRatesTask = GetAgentLatestSuitePassRatesAsync(agentId, cancellationToken);
        var countsTask = GetAgentEntityCountsAsync(agentId, cancellationToken);

        await Task.WhenAll(passRateTask, suitePassRatesTask, countsTask);

        return new AgentOverviewStat(
            Summary: summary,
            TimeSeries: timeSeries,
            PassRateTrend: passRateTask.Result,
            SuitePassRates: suitePassRatesTask.Result,
            Counts: countsTask.Result);
    }

    public async Task<IReadOnlyList<AgentTimeSeriesPoint>> GetAgentTimeSeriesAsync(
        Guid agentId,
        DateTimeOffset from,
        DateTimeOffset to,
        StatisticsBucket bucket,
        CancellationToken cancellationToken = default)
    {
        var (calls, endpointMap) = await LoadAgentCallsAsync(agentId, from, to, cancellationToken);
        return BucketCalls(calls, endpointMap, from, to, bucket);
    }

    public async Task<IReadOnlyList<AgentPassRatePoint>> GetAgentPassRateTrendAsync(
        Guid agentId,
        DateTimeOffset from,
        DateTimeOffset to,
        StatisticsBucket bucket,
        CancellationToken cancellationToken = default)
    {
        var context = contextFactory();

        var rows = await context.Set<TestRunEntity>().AsNoTracking()
            .Join(context.Set<TestRunGroupEntity>(),
                r => r.Group,
                g => g.Id,
                (r, g) => new { Run = r, GroupSuite = g.Suite })
            .Join(context.Set<TestSuiteEntity>(),
                x => x.GroupSuite,
                s => s.Id,
                (x, s) => new { x.Run, SuiteAgent = s.Agent })
            .Where(x => x.SuiteAgent == agentId)
            .Where(x => x.Run.Status == TestRunStatus.Completed)
            .Where(x => x.Run.CompletedAt != null)
            .Select(x => new { x.Run.CompletedAt, x.Run.StatTestCases, x.Run.StatPassed })
            .ToListAsync(cancellationToken);

        var inRange = rows
            .Where(r => r.CompletedAt!.Value >= from && r.CompletedAt!.Value <= to)
            .ToList();

        var grouped = inRange
            .GroupBy(r => BucketKey(r.CompletedAt!.Value, bucket))
            .ToDictionary(
                g => g.Key,
                g => (Passed: g.Sum(x => x.StatPassed), TestCases: g.Sum(x => x.StatTestCases)));

        return EnumerateBuckets(from, to, bucket)
            .Select(b => grouped.TryGetValue(b, out var v)
                ? new AgentPassRatePoint(b, v.Passed, v.TestCases)
                : new AgentPassRatePoint(b, 0, 0))
            .ToArray();
    }

    public async Task<IReadOnlyList<AgentSuitePassRate>> GetAgentLatestSuitePassRatesAsync(
        Guid agentId,
        CancellationToken cancellationToken = default)
    {
        var context = contextFactory();

        var suites = await context.Set<TestSuiteEntity>().AsNoTracking()
            .Where(s => s.Agent == agentId)
            .Select(s => new { s.Id, s.Name })
            .ToListAsync(cancellationToken);

        if (suites.Count == 0)
            return Array.Empty<AgentSuitePassRate>();

        var suiteIds = suites.Select(s => s.Id).ToList();

        var runs = await context.Set<TestRunEntity>().AsNoTracking()
            .Join(context.Set<TestRunGroupEntity>(),
                r => r.Group,
                g => g.Id,
                (r, g) => new { Run = r, GroupSuite = g.Suite })
            .Where(x => suiteIds.Contains(x.GroupSuite))
            .Where(x => x.Run.Status == TestRunStatus.Completed)
            .Where(x => x.Run.CompletedAt != null)
            .Select(x => new { x.GroupSuite, x.Run.CompletedAt, x.Run.StatPassed, x.Run.StatTestCases })
            .ToListAsync(cancellationToken);

        var latestPerSuite = runs
            .GroupBy(r => r.GroupSuite)
            .Select(g => g.OrderByDescending(r => r.CompletedAt).First())
            .ToDictionary(r => r.GroupSuite);

        return suites
            .Where(s => latestPerSuite.ContainsKey(s.Id))
            .Select(s =>
            {
                var run = latestPerSuite[s.Id];
                return new AgentSuitePassRate(
                    SuiteId: s.Id,
                    SuiteName: s.Name,
                    LatestRunAt: run.CompletedAt!.Value,
                    Passed: run.StatPassed,
                    TestCases: run.StatTestCases);
            })
            .OrderByDescending(s => s.LatestRunAt)
            .ToArray();
    }

    public async Task<AgentEntityCounts> GetAgentEntityCountsAsync(
        Guid agentId,
        CancellationToken cancellationToken = default)
    {
        var context = contextFactory();

        var suites = await context.Set<TestSuiteEntity>().AsNoTracking()
            .Where(s => s.Agent == agentId)
            .Select(s => s.TestCases)
            .ToListAsync(cancellationToken);

        var suiteCount = suites.Count;
        var testCaseCount = suites.Sum(c => c.Count);

        var proposals = await context.Set<OptimizationProposalEntity>().AsNoTracking()
            .Where(p => p.Agent == agentId)
            .Select(p => p.Status)
            .ToListAsync(cancellationToken);

        var totalProposals = proposals.Count;
        var openProposals = proposals.Count(s => s == ProposalStatus.Draft);

        return new AgentEntityCounts(
            SuiteCount: suiteCount,
            TestCaseCount: testCaseCount,
            OpenProposalCount: openProposals,
            TotalProposalCount: totalProposals);
    }

    private async Task<(List<AgentCallEntity> Calls, IReadOnlyDictionary<Guid, IModelEndpoint> Endpoints)> LoadAgentCallsAsync(
        Guid agentId,
        DateTimeOffset from,
        DateTimeOffset to,
        CancellationToken cancellationToken)
    {
        var context = contextFactory();

        var calls = await context.Set<AgentCallEntity>().AsNoTracking()
            .Where(e => e.AgentId == agentId)
            .Where(e => e.CreatedAt >= from)
            .Where(e => e.CreatedAt <= to)
            .ToListAsync(cancellationToken);

        var endpointIds = calls.Select(c => c.EndpointId).Distinct().ToList();
        var endpointMap = new Dictionary<Guid, IModelEndpoint>();
        foreach (var id in endpointIds)
        {
            var endpoint = await endpoints.FindAsync(id, cancellationToken);
            if (endpoint is not null)
                endpointMap[id] = endpoint;
        }

        return (calls, endpointMap);
    }

    private static IReadOnlyList<AgentTimeSeriesPoint> BucketCalls(
        IReadOnlyList<AgentCallEntity> calls,
        IReadOnlyDictionary<Guid, IModelEndpoint> endpointMap,
        DateTimeOffset from,
        DateTimeOffset to,
        StatisticsBucket bucket)
    {
        var grouped = calls
            .GroupBy(c => BucketKey(c.CreatedAt, bucket))
            .ToDictionary(
                g => g.Key,
                g =>
                {
                    var list = g.ToList();
                    var traceCount = list.Count;
                    var inputTokens = list.Sum(c => (long)(c.InputTokens ?? 0));
                    var outputTokens = list.Sum(c => (long)(c.OutputTokens ?? 0));
                    var avgLatencyMs = list.Any(c => c.LatencyMs.HasValue)
                        ? list.Where(c => c.LatencyMs.HasValue).Average(c => c.LatencyMs!.Value)
                        : 0d;
                    var costEur = 0m;
                    foreach (var c in list)
                    {
                        if (!endpointMap.TryGetValue(c.EndpointId, out var endpoint))
                            continue;
                        var usage = new TokenUsage(c.InputTokens ?? 0, c.OutputTokens ?? 0);
                        costEur += endpoint.CalculateCost(usage) ?? 0m;
                    }
                    return (TraceCount: traceCount, InputTokens: inputTokens, OutputTokens: outputTokens, CostEur: costEur, AvgLatencyMs: avgLatencyMs);
                });

        return EnumerateBuckets(from, to, bucket)
            .Select(b => grouped.TryGetValue(b, out var v)
                ? new AgentTimeSeriesPoint(b, v.TraceCount, v.InputTokens, v.OutputTokens, Math.Round(v.CostEur, 6), v.AvgLatencyMs)
                : new AgentTimeSeriesPoint(b, 0, 0, 0, 0m, 0d))
            .ToArray();
    }

    private static AgentTimeSummary SummarizeCalls(
        IReadOnlyList<AgentCallEntity> calls,
        IReadOnlyDictionary<Guid, IModelEndpoint> endpointMap)
    {
        if (calls.Count == 0)
            return new AgentTimeSummary(0, 0, 0, 0m, 0d);

        var inputTokens = calls.Sum(c => (long)(c.InputTokens ?? 0));
        var outputTokens = calls.Sum(c => (long)(c.OutputTokens ?? 0));
        var latencies = calls.Where(c => c.LatencyMs.HasValue).Select(c => c.LatencyMs!.Value).ToList();
        var avgLatency = latencies.Count > 0 ? latencies.Average() : 0d;

        var totalCost = 0m;
        foreach (var c in calls)
        {
            if (!endpointMap.TryGetValue(c.EndpointId, out var endpoint))
                continue;
            var usage = new TokenUsage(c.InputTokens ?? 0, c.OutputTokens ?? 0);
            totalCost += endpoint.CalculateCost(usage) ?? 0m;
        }

        return new AgentTimeSummary(
            TotalTraces: calls.Count,
            TotalInputTokens: inputTokens,
            TotalOutputTokens: outputTokens,
            TotalCostEur: Math.Round(totalCost, 6),
            AvgLatencyMs: avgLatency);
    }

    private static DateTimeOffset BucketKey(DateTimeOffset ts, StatisticsBucket bucket)
    {
        var utc = ts.ToUniversalTime();
        return bucket switch
        {
            StatisticsBucket.FiveMinutes => new DateTimeOffset(
                utc.Year, utc.Month, utc.Day, utc.Hour, utc.Minute - (utc.Minute % 5), 0, TimeSpan.Zero),
            StatisticsBucket.Hourly => new DateTimeOffset(
                utc.Year, utc.Month, utc.Day, utc.Hour, 0, 0, TimeSpan.Zero),
            StatisticsBucket.Daily => new DateTimeOffset(
                utc.Year, utc.Month, utc.Day, 0, 0, 0, TimeSpan.Zero),
            _ => throw new ArgumentOutOfRangeException(nameof(bucket), bucket, null),
        };
    }

    private static IEnumerable<DateTimeOffset> EnumerateBuckets(DateTimeOffset from, DateTimeOffset to, StatisticsBucket bucket)
    {
        var step = bucket switch
        {
            StatisticsBucket.FiveMinutes => TimeSpan.FromMinutes(5),
            StatisticsBucket.Hourly => TimeSpan.FromHours(1),
            StatisticsBucket.Daily => TimeSpan.FromDays(1),
            _ => throw new ArgumentOutOfRangeException(nameof(bucket), bucket, null),
        };

        var current = BucketKey(from, bucket);
        var end = BucketKey(to, bucket);
        while (current <= end)
        {
            yield return current;
            current = current.Add(step);
        }
    }
}
