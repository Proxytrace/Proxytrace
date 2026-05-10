using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Trsr.Application.Statistics;
using Trsr.Storage.Internal.Entities.Agent;
using Trsr.Storage.Internal.Entities.AgentCall;
using Trsr.Storage.Internal.Entities.Model;
using Trsr.Storage.Internal.Entities.ModelEndpoint;

namespace Trsr.Storage.Internal.Statistics;

[UsedImplicitly]
internal class AgentCallStatsQueries : IAgentCallStatsReader
{
    private readonly Func<StorageDbContext> contextFactory;

    public AgentCallStatsQueries(Func<StorageDbContext> contextFactory)
    {
        this.contextFactory = contextFactory;
    }

    public async Task<StatisticsSummary> GetSummaryAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
    {
        StorageDbContext context = contextFactory();
        IQueryable<AgentCallEntity> q = ApplyFilter(context, context.Set<AgentCallEntity>().AsNoTracking(), filter);

        List<AgentCallEntity> rows = await q.ToListAsync(cancellationToken);

        long totalCalls = rows.Count;
        long totalInput = rows.Sum(r => (long?)r.InputTokens ?? 0L);
        long totalOutput = rows.Sum(r => (long?)r.OutputTokens ?? 0L);
        double avgLatency = rows.Count == 0 ? 0d : rows.Average(r => r.LatencyMs ?? 0d);

        return new StatisticsSummary(
            TotalCalls: totalCalls,
            TotalInputTokens: totalInput,
            TotalOutputTokens: totalOutput,
            AvgLatencyMs: avgLatency,
            OverallPassRate: 0d);
    }

    public async Task<IReadOnlyList<TokenUsageStat>> GetTokenUsageAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
    {
        StorageDbContext context = contextFactory();
        IQueryable<AgentCallEntity> q = ApplyFilter(context, context.Set<AgentCallEntity>().AsNoTracking(), filter);

        List<AgentCallEntity> rows = await q.ToListAsync(cancellationToken);

        return rows
            .GroupBy(r => new { Date = DateOnly.FromDateTime(r.CreatedAt.UtcDateTime), r.EndpointId })
            .Select(g => new TokenUsageStat(
                Date: g.Key.Date,
                EndpointId: g.Key.EndpointId,
                InputTokens: g.Sum(r => (long?)r.InputTokens ?? 0L),
                OutputTokens: g.Sum(r => (long?)r.OutputTokens ?? 0L)))
            .OrderBy(s => s.Date)
            .ThenBy(s => s.EndpointId)
            .ToArray();
    }

    public async Task<IReadOnlyList<LatencyStat>> GetLatencyAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
    {
        StorageDbContext context = contextFactory();
        IQueryable<AgentCallEntity> q = ApplyFilter(context, context.Set<AgentCallEntity>().AsNoTracking(), filter);

        var samples = await q
            .Where(c => c.LatencyMs != null)
            .Select(c => new { c.EndpointId, Latency = c.LatencyMs ?? 0 })
            .ToListAsync(cancellationToken);

        return samples
            .GroupBy(s => s.EndpointId)
            .Select(g =>
            {
                double[] sorted = g.Select(s => s.Latency).OrderBy(v => v).ToArray();
                return new LatencyStat(
                    EndpointId: g.Key,
                    P50Ms: Percentile(sorted, 0.50),
                    P95Ms: Percentile(sorted, 0.95),
                    P99Ms: Percentile(sorted, 0.99),
                    MinMs: sorted[0],
                    MaxMs: sorted[^1],
                    SampleCount: sorted.Length);
            })
            .OrderBy(s => s.EndpointId)
            .ToArray();
    }

    public async Task<IReadOnlyList<ErrorRateStat>> GetErrorRatesAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
    {
        StorageDbContext context = contextFactory();
        IQueryable<AgentCallEntity> q = ApplyFilter(context, context.Set<AgentCallEntity>().AsNoTracking(), filter);

        var rows = await q
            .GroupBy(c => c.EndpointId)
            .Select(g => new
            {
                EndpointId = g.Key,
                Total = g.Count(),
                Errors = g.Count(c => c.HttpStatus >= 400),
            })
            .ToListAsync(cancellationToken);

        return rows
            .Select(r => new ErrorRateStat(
                EndpointId: r.EndpointId,
                TotalCalls: r.Total,
                ErrorCalls: r.Errors,
                ErrorRate: r.Total == 0 ? 0d : r.Errors / (double)r.Total))
            .OrderBy(s => s.EndpointId)
            .ToArray();
    }

    public async Task<IReadOnlyList<ModelBreakdownStat>> GetModelBreakdownAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
    {
        StorageDbContext context = contextFactory();
        IQueryable<AgentCallEntity> q = ApplyFilter(context, context.Set<AgentCallEntity>().AsNoTracking(), filter);

        var rows = await q
            .GroupBy(c => c.EndpointId)
            .Select(g => new
            {
                EndpointId = g.Key,
                CallCount = g.Count(),
                TotalInput = g.Sum(c => (long?)(long?)c.InputTokens ?? 0L),
                TotalOutput = g.Sum(c => (long?)(long?)c.OutputTokens ?? 0L),
                AvgLatency = g.Average(c => c.LatencyMs ?? 0d),
            })
            .ToListAsync(cancellationToken);

        Guid[] endpointIds = rows.Select(r => r.EndpointId).Distinct().ToArray();
        Dictionary<Guid, ModelEndpointEntity> endpoints = await context.Set<ModelEndpointEntity>()
            .AsNoTracking()
            .Where(e => endpointIds.Contains(e.Id))
            .ToDictionaryAsync(e => e.Id, cancellationToken);

        Guid[] modelIds = endpoints.Values.Select(e => e.Model).Distinct().ToArray();
        Dictionary<Guid, ModelEntity> models = await context.Set<ModelEntity>()
            .AsNoTracking()
            .Where(m => modelIds.Contains(m.Id))
            .ToDictionaryAsync(m => m.Id, cancellationToken);

        return rows
            .Select(r =>
            {
                string modelName = "(unknown)";
                if (endpoints.TryGetValue(r.EndpointId, out ModelEndpointEntity? endpoint)
                    && models.TryGetValue(endpoint.Model, out ModelEntity? model))
                {
                    modelName = model.Name;
                }

                return new ModelBreakdownStat(
                    EndpointId: r.EndpointId,
                    ModelName: modelName,
                    CallCount: r.CallCount,
                    TotalInputTokens: r.TotalInput,
                    TotalOutputTokens: r.TotalOutput,
                    AvgDurationMs: r.AvgLatency);
            })
            .OrderBy(s => s.ModelName)
            .ToArray();
    }

    public async Task<IReadOnlyList<AgentBreakdownStat>> GetAgentBreakdownAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
    {
        StorageDbContext context = contextFactory();
        IQueryable<AgentCallEntity> q = ApplyFilter(context, context.Set<AgentCallEntity>().AsNoTracking(), filter);

        var rows = await q
            .GroupBy(c => c.AgentId)
            .Select(g => new AgentBreakdownStat(g.Key, g.Count()))
            .ToListAsync(cancellationToken);

        return rows.OrderByDescending(r => r.CallCount).ThenBy(r => r.AgentId).ToArray();
    }

    public async Task<IReadOnlyList<CostEstimateStat>> GetCostEstimateAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
    {
        StorageDbContext context = contextFactory();
        IQueryable<AgentCallEntity> q = ApplyFilter(context, context.Set<AgentCallEntity>().AsNoTracking(), filter);

        var rows = await q
            .GroupBy(c => c.EndpointId)
            .Select(g => new
            {
                EndpointId = g.Key,
                TotalInput = g.Sum(c => (long?)(long?)c.InputTokens ?? 0L),
                TotalOutput = g.Sum(c => (long?)(long?)c.OutputTokens ?? 0L),
            })
            .ToListAsync(cancellationToken);

        Guid[] endpointIds = rows.Select(r => r.EndpointId).Distinct().ToArray();
        Dictionary<Guid, ModelEndpointEntity> endpoints = await context.Set<ModelEndpointEntity>()
            .AsNoTracking()
            .Where(e => endpointIds.Contains(e.Id))
            .ToDictionaryAsync(e => e.Id, cancellationToken);

        return rows
            .Select(r =>
            {
                endpoints.TryGetValue(r.EndpointId, out ModelEndpointEntity? endpoint);
                decimal? inputCost = endpoint?.InputTokenCost is { } ic ? ic * r.TotalInput : null;
                decimal? outputCost = endpoint?.OutputTokenCost is { } oc ? oc * r.TotalOutput : null;
                decimal? totalCost = inputCost.HasValue || outputCost.HasValue
                    ? (inputCost ?? 0m) + (outputCost ?? 0m)
                    : null;
                if (endpoint?.InputTokenCost is null && endpoint?.OutputTokenCost is null)
                {
                    totalCost = null;
                }
                return new CostEstimateStat(
                    EndpointId: r.EndpointId,
                    InputCostEur: inputCost,
                    OutputCostEur: outputCost,
                    TotalCostEur: totalCost);
            })
            .OrderBy(s => s.EndpointId)
            .ToArray();
    }

    public async Task<IReadOnlyList<AgentTimeSeriesPoint>> GetAgentTimeSeriesAsync(
        Guid agentId,
        DateTimeOffset from,
        DateTimeOffset to,
        StatisticsBucket bucket,
        CancellationToken cancellationToken = default)
    {
        StorageDbContext context = contextFactory();

        List<AgentCallEntity> rows = await context.Set<AgentCallEntity>()
            .AsNoTracking()
            .Where(c => c.AgentId == agentId && c.CreatedAt >= from && c.CreatedAt <= to)
            .ToListAsync(cancellationToken);

        Guid[] endpointIds = rows.Select(r => r.EndpointId).Distinct().ToArray();
        Dictionary<Guid, ModelEndpointEntity> endpoints = await context.Set<ModelEndpointEntity>()
            .AsNoTracking()
            .Where(e => endpointIds.Contains(e.Id))
            .ToDictionaryAsync(e => e.Id, cancellationToken);

        return rows
            .GroupBy(r => BucketStart(r.CreatedAt, bucket))
            .Select(g =>
            {
                long inputTokens = g.Sum(r => (long?)r.InputTokens ?? 0L);
                long outputTokens = g.Sum(r => (long?)r.OutputTokens ?? 0L);
                double avgLatency = g.Average(r => r.LatencyMs ?? 0d);
                decimal cost = 0m;
                foreach (AgentCallEntity call in g)
                {
                    if (!endpoints.TryGetValue(call.EndpointId, out ModelEndpointEntity? endpoint))
                    {
                        continue;
                    }
                    if (endpoint.InputTokenCost is { } ic && call.InputTokens.HasValue)
                    {
                        cost += ic * (long)call.InputTokens.Value;
                    }
                    if (endpoint.OutputTokenCost is { } oc && call.OutputTokens.HasValue)
                    {
                        cost += oc * (long)call.OutputTokens.Value;
                    }
                }

                return new AgentTimeSeriesPoint(
                    BucketStart: g.Key,
                    TraceCount: g.Count(),
                    InputTokens: inputTokens,
                    OutputTokens: outputTokens,
                    CostEur: cost,
                    AvgLatencyMs: avgLatency);
            })
            .OrderBy(p => p.BucketStart)
            .ToArray();
    }

    public async Task<AgentTimeSummary> GetAgentTimeSummaryAsync(
        Guid agentId,
        DateTimeOffset from,
        DateTimeOffset to,
        CancellationToken cancellationToken = default)
    {
        StorageDbContext context = contextFactory();

        List<AgentCallEntity> rows = await context.Set<AgentCallEntity>()
            .AsNoTracking()
            .Where(c => c.AgentId == agentId && c.CreatedAt >= from && c.CreatedAt <= to)
            .ToListAsync(cancellationToken);

        Guid[] endpointIds = rows.Select(r => r.EndpointId).Distinct().ToArray();
        Dictionary<Guid, ModelEndpointEntity> endpoints = await context.Set<ModelEndpointEntity>()
            .AsNoTracking()
            .Where(e => endpointIds.Contains(e.Id))
            .ToDictionaryAsync(e => e.Id, cancellationToken);

        long totalInput = rows.Sum(r => (long?)r.InputTokens ?? 0L);
        long totalOutput = rows.Sum(r => (long?)r.OutputTokens ?? 0L);
        double avgLatency = rows.Count == 0 ? 0d : rows.Average(r => r.LatencyMs ?? 0d);

        decimal totalCost = 0m;
        foreach (AgentCallEntity call in rows)
        {
            if (!endpoints.TryGetValue(call.EndpointId, out ModelEndpointEntity? endpoint))
            {
                continue;
            }
            if (endpoint.InputTokenCost is { } ic && call.InputTokens.HasValue)
            {
                totalCost += ic * (long)call.InputTokens.Value;
            }
            if (endpoint.OutputTokenCost is { } oc && call.OutputTokens.HasValue)
            {
                totalCost += oc * (long)call.OutputTokens.Value;
            }
        }

        return new AgentTimeSummary(
            TotalTraces: rows.Count,
            TotalInputTokens: totalInput,
            TotalOutputTokens: totalOutput,
            TotalCostEur: totalCost,
            AvgLatencyMs: avgLatency);
    }

    private static IQueryable<AgentCallEntity> ApplyFilter(
        StorageDbContext context,
        IQueryable<AgentCallEntity> query,
        StatisticsFilter filter)
    {
        if (filter.AgentId.HasValue)
        {
            Guid agentId = filter.AgentId.Value;
            query = query.Where(c => c.AgentId == agentId);
        }
        if (filter.EndpointId.HasValue)
        {
            Guid endpointId = filter.EndpointId.Value;
            query = query.Where(c => c.EndpointId == endpointId);
        }
        if (filter.ProjectId.HasValue)
        {
            Guid projectId = filter.ProjectId.Value;
            IQueryable<Guid> agentIds = context.Set<AgentEntity>()
                .AsNoTracking()
                .Where(a => a.Project == projectId)
                .Select(a => a.Id);
            query = query.Where(c => agentIds.Contains(c.AgentId));
        }
        if (filter.From.HasValue)
        {
            DateTimeOffset from = filter.From.Value;
            query = query.Where(c => c.CreatedAt >= from);
        }
        if (filter.To.HasValue)
        {
            DateTimeOffset to = filter.To.Value;
            query = query.Where(c => c.CreatedAt <= to);
        }
        return query;
    }

    private static double Percentile(double[] sorted, double p)
    {
        if (sorted.Length == 0)
        {
            return 0d;
        }
        if (sorted.Length == 1)
        {
            return sorted[0];
        }
        double rank = p * (sorted.Length - 1);
        int lower = (int)Math.Floor(rank);
        int upper = (int)Math.Ceiling(rank);
        if (lower == upper)
        {
            return sorted[lower];
        }
        double weight = rank - lower;
        return sorted[lower] * (1 - weight) + sorted[upper] * weight;
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
