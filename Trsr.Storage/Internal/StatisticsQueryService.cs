using Microsoft.EntityFrameworkCore;
using Trsr.Common.Async;
using Trsr.Domain;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.TestResult;
using Trsr.Storage.Internal.Entities.AgentCall;
using Trsr.Storage.Internal.Entities.Agent;
using Trsr.Storage.Internal.Entities.TestRun;
using Trsr.Storage.Internal.Entities.TestResult;

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
                TotalInputTokens = (long)g.Sum(e => e.InputTokens),
                TotalOutputTokens = (long)g.Sum(e => e.OutputTokens),
                AvgLatencyMs = g.Average(e => (double)e.DurationMs),
            })
            .FirstOrDefaultAsync(cancellationToken);

        double passRate = 0;
        var results = await context.Set<TestResultEntity>().AsNoTracking().ToListAsync(cancellationToken);
        if (results.Count > 0)
        {
            passRate = (double)results.Count(r => r.Evaluation == Evaluation.Pass) / results.Count;
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
                InputTokens: g.Sum(e => (long)e.InputTokens),
                OutputTokens: g.Sum(e => (long)e.OutputTokens)))
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
                var sorted = g.Select(e => (double)e.DurationMs).OrderBy(x => x).ToArray();
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

        var runs = await context.Set<TestRunEntity>()
            .AsNoTracking()
            .Where(r => agentIds.Contains(r.Agent))
            .Where(r => filter.From == null || r.Timestamp >= filter.From)
            .Where(r => filter.To == null || r.Timestamp <= filter.To)
            .ToListAsync(cancellationToken);

        var resultIds = runs.SelectMany(r => r.TestResults).Distinct().ToList();
        var results = await context.Set<TestResultEntity>()
            .AsNoTracking()
            .Where(r => resultIds.Contains(r.Id))
            .ToListAsync(cancellationToken);

        var resultLookup = results.ToDictionary(r => r.Id);

        return runs.Select(run =>
        {
            var runResults = run.TestResults
                .Where(id => resultLookup.ContainsKey(id))
                .Select(id => resultLookup[id])
                .ToArray();

            return new PassRateStat(
                AgentId: run.Agent,
                RunTimestamp: run.Timestamp,
                PassCount: runResults.Count(r => r.Evaluation == Evaluation.Pass),
                FailCount: runResults.Count(r => r.Evaluation == Evaluation.Fail),
                UndecidedCount: runResults.Count(r => r.Evaluation == Evaluation.Undecided));
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
                TotalInputTokens = (long)g.Sum(e => e.InputTokens),
                TotalOutputTokens = (long)g.Sum(e => e.OutputTokens),
                AvgDurationMs = g.Average(e => (double)e.DurationMs),
            })
            .ToListAsync(cancellationToken);

        return stats
            .Select(s => new ModelBreakdownStat(
                EndpointId: s.EndpointId,
                CallCount: s.CallCount,
                TotalInputTokens: s.TotalInputTokens,
                TotalOutputTokens: s.TotalOutputTokens,
                AvgDurationMs: s.AvgDurationMs))
            .OrderByDescending(s => s.CallCount)
            .ToArray();
    }

    public async Task<IReadOnlyList<CostEstimateStat>> GetCostEstimateAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
    {
        IReadOnlyList<ModelBreakdownStat> breakdown = await GetModelBreakdownAsync(filter, cancellationToken);

        return await breakdown.Select(async b =>
        {
            var endpoint = await endpoints.GetAsync(b.EndpointId, cancellationToken);
            var inputCost = b.TotalInputTokens / 1_000_000m * endpoint.InputTokenCost;
            var outputCost = b.TotalOutputTokens / 1_000_000m * endpoint.OutputTokenCost;

            return new CostEstimateStat(
                EndpointId: b.EndpointId,
                InputCostEur: Math.Round(inputCost, 4),
                OutputCostEur: Math.Round(outputCost, 4),
                TotalCostEur: Math.Round(inputCost + outputCost, 4));
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
