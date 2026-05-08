using Microsoft.EntityFrameworkCore;
using Trsr.Common.Async;
using Trsr.Domain;
using Trsr.Domain.Evaluation;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Usage;
using Trsr.Storage.Internal.Entities.AgentCall;
using Trsr.Storage.Internal.Entities.Agent;
using Trsr.Storage.Internal.Entities.Model;
using Trsr.Storage.Internal.Entities.ModelEndpoint;
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
}
