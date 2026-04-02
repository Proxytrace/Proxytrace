using Microsoft.EntityFrameworkCore;
using Trsr.Domain;
using Trsr.Domain.TestResult;
using Trsr.Storage.Internal.Entities.AgentCall;
using Trsr.Storage.Internal.Entities.Agent;
using Trsr.Storage.Internal.Entities.TestRun;
using Trsr.Storage.Internal.Entities.TestResult;

namespace Trsr.Storage.Internal;

internal class StatisticsQueryService : IStatisticsQueryService
{
    // Approximate token pricing per million tokens (input / output) in USD
    private static readonly Dictionary<string, (decimal Input, decimal Output)> PriceTable = new(StringComparer.OrdinalIgnoreCase)
    {
        ["gpt-4o"]           = (2.50m, 10.00m),
        ["gpt-4o-mini"]      = (0.15m,  0.60m),
        ["gpt-4-turbo"]      = (10.00m, 30.00m),
        ["gpt-4"]            = (30.00m, 60.00m),
        ["gpt-3.5-turbo"]    = (0.50m,  1.50m),
        ["claude-3-5-sonnet"] = (3.00m, 15.00m),
        ["claude-3-5-haiku"]  = (0.80m,  4.00m),
        ["claude-3-opus"]     = (15.00m, 75.00m),
    };

    private readonly Func<StorageDbContext> contextFactory;

    public StatisticsQueryService(Func<StorageDbContext> contextFactory)
    {
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
            .GroupBy(e => (Date: DateOnly.FromDateTime(e.CreatedAt.UtcDateTime.Date), e.Model))
            .Select(g => new TokenUsageStat(
                Date: g.Key.Date,
                Model: g.Key.Model,
                InputTokens: g.Sum(e => (long)e.InputTokens),
                OutputTokens: g.Sum(e => (long)e.OutputTokens)))
            .OrderBy(s => s.Date)
            .ThenBy(s => s.Model)
            .ToArray();
    }

    public async Task<IReadOnlyList<LatencyStat>> GetLatencyAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
    {
        var context = contextFactory();
        var calls = await ApplyCallFilter(context.Set<AgentCallEntity>().AsNoTracking(), filter, context)
            .ToListAsync(cancellationToken);

        return calls
            .GroupBy(e => e.Model)
            .Select(g =>
            {
                var sorted = g.Select(e => (double)e.DurationMs).OrderBy(x => x).ToArray();
                return new LatencyStat(
                    Model: g.Key,
                    P50Ms: Percentile(sorted, 0.50),
                    P95Ms: Percentile(sorted, 0.95),
                    P99Ms: Percentile(sorted, 0.99),
                    MinMs: sorted.Length > 0 ? sorted[0] : 0,
                    MaxMs: sorted.Length > 0 ? sorted[^1] : 0,
                    SampleCount: sorted.Length);
            })
            .OrderBy(s => s.Model)
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
            .GroupBy(e => (e.Model, e.Provider))
            .Select(g => new ErrorRateStat(
                Model: g.Key.Model,
                Provider: g.Key.Provider,
                TotalCalls: g.Count(),
                ErrorCalls: g.Count(e => e.HttpStatus >= 400),
                ErrorRate: g.Count() == 0 ? 0 : (double)g.Count(e => e.HttpStatus >= 400) / g.Count()))
            .OrderBy(s => s.Model)
            .ToArray();
    }

    public async Task<IReadOnlyList<ModelBreakdownStat>> GetModelBreakdownAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
    {
        var context = contextFactory();
        var stats = await ApplyCallFilter(context.Set<AgentCallEntity>().AsNoTracking(), filter, context)
            .GroupBy(e => e.Model)
            .Select(g => new
            {
                Model = g.Key,
                CallCount = g.Count(),
                TotalInputTokens = (long)g.Sum(e => e.InputTokens),
                TotalOutputTokens = (long)g.Sum(e => e.OutputTokens),
                AvgDurationMs = g.Average(e => (double)e.DurationMs),
            })
            .ToListAsync(cancellationToken);

        return stats
            .Select(s => new ModelBreakdownStat(
                Model: s.Model,
                CallCount: s.CallCount,
                TotalInputTokens: s.TotalInputTokens,
                TotalOutputTokens: s.TotalOutputTokens,
                AvgDurationMs: s.AvgDurationMs))
            .OrderByDescending(s => s.CallCount)
            .ToArray();
    }

    public async Task<IReadOnlyList<CostEstimateStat>> GetCostEstimateAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
    {
        var breakdown = await GetModelBreakdownAsync(filter, cancellationToken);

        return breakdown.Select(b =>
        {
            var priceKey = PriceTable.Keys.FirstOrDefault(k => b.Model.Contains(k, StringComparison.OrdinalIgnoreCase));
            var (inputPrice, outputPrice) = priceKey is not null ? PriceTable[priceKey] : (0m, 0m);

            var inputCost = b.TotalInputTokens / 1_000_000m * inputPrice;
            var outputCost = b.TotalOutputTokens / 1_000_000m * outputPrice;

            return new CostEstimateStat(
                Model: b.Model,
                InputCostUsd: Math.Round(inputCost, 4),
                OutputCostUsd: Math.Round(outputCost, 4),
                TotalCostUsd: Math.Round(inputCost + outputCost, 4));
        })
        .ToArray();
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
            query = query.Where(e => e.AgentId.HasValue &&
                context.Set<AgentEntity>()
                    .Where(a => a.Project == projectId)
                    .Select(a => (Guid?)a.Id)
                    .Contains(e.AgentId));
        }

        if (filter.Model is not null)
            query = query.Where(e => e.Model == filter.Model);

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
