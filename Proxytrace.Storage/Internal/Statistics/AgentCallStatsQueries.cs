using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Proxytrace.Application.Statistics;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.Usage;
using Proxytrace.Storage.Internal.Entities.AgentCall;
using Proxytrace.Storage.Internal.Entities.AgentVersion;
using Proxytrace.Storage.Internal.Entities.Model;
using Proxytrace.Storage.Internal.Entities.ModelEndpoint;

namespace Proxytrace.Storage.Internal.Statistics;

[UsedImplicitly]
internal class AgentCallStatsQueries : IAgentCallStatsReader
{
    private readonly Func<StorageDbContext> contextFactory;
    private readonly IMapper<IModelEndpoint, ModelEndpointEntity> endpointMapper;

    public AgentCallStatsQueries(
        Func<StorageDbContext> contextFactory,
        IMapper<IModelEndpoint, ModelEndpointEntity> endpointMapper)
    {
        this.contextFactory = contextFactory;
        this.endpointMapper = endpointMapper;
    }

    public async Task<StatisticsSummary> GetSummaryAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
    {
        StorageDbContext context = contextFactory();
        IQueryable<AgentCallEntity> q = Query(context, filter);

        var agg = await q
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Count = (long)g.Count(),
                Input = g.Sum(c => (long?)c.InputTokens ?? 0L),
                Output = g.Sum(c => (long?)c.OutputTokens ?? 0L),
                AvgLatency = g.Average(c => c.LatencyMs ?? 0d),
            })
            .FirstOrDefaultAsync(cancellationToken);

        return new StatisticsSummary(
            TotalCalls: agg?.Count ?? 0L,
            TotalInputTokens: agg?.Input ?? 0L,
            TotalOutputTokens: agg?.Output ?? 0L,
            AvgLatencyMs: agg?.AvgLatency ?? 0d,
            OverallPassRate: null);
    }

    public async Task<IReadOnlyList<TokenUsageStat>> GetTokenUsageAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
    {
        StorageDbContext context = contextFactory();
        IQueryable<AgentCallEntity> q = Query(context, filter);

        var raw = await q
            .Select(c => new { c.CreatedAt, c.EndpointId, c.InputTokens, c.OutputTokens })
            .ToListAsync(cancellationToken);

        return raw
            .GroupBy(c => new { Date = DateOnly.FromDateTime(c.CreatedAt.UtcDateTime), c.EndpointId })
            .Select(g => new TokenUsageStat(
                Date: g.Key.Date,
                EndpointId: g.Key.EndpointId,
                InputTokens: g.Sum(c => (long?)c.InputTokens ?? 0L),
                OutputTokens: g.Sum(c => (long?)c.OutputTokens ?? 0L)))
            .OrderBy(s => s.Date)
            .ThenBy(s => s.EndpointId)
            .ToArray();
    }

    public async Task<IReadOnlyList<LatencyStat>> GetLatencyAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
    {
        StorageDbContext context = contextFactory();
        IQueryable<AgentCallEntity> q = Query(context, filter);

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
        IQueryable<AgentCallEntity> q = Query(context, filter);

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
        IQueryable<AgentCallEntity> q = Query(context, filter);

        var rows = await q
            .GroupBy(c => c.EndpointId)
            .Select(g => new
            {
                EndpointId = g.Key,
                CallCount = g.Count(),
                TotalInput = g.Sum(c => (long?)c.InputTokens ?? 0L),
                TotalOutput = g.Sum(c => (long?)c.OutputTokens ?? 0L),
                AvgLatency = g.Average(c => c.LatencyMs ?? 0d),
            })
            .ToListAsync(cancellationToken);

        Guid[] endpointIds = rows.Select(r => r.EndpointId).ToArray();
        Dictionary<Guid, string> modelNames = await LoadModelNamesAsync(context, endpointIds, cancellationToken);

        return rows
            .Select(r => new ModelBreakdownStat(
                EndpointId: r.EndpointId,
                ModelName: modelNames.GetValueOrDefault(r.EndpointId, "(unknown)"),
                CallCount: r.CallCount,
                TotalInputTokens: r.TotalInput,
                TotalOutputTokens: r.TotalOutput,
                AvgDurationMs: r.AvgLatency))
            .OrderBy(s => s.ModelName)
            .ToArray();
    }

    public async Task<IReadOnlyList<AgentBreakdownStat>> GetAgentBreakdownAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
    {
        StorageDbContext context = contextFactory();
        IQueryable<AgentCallEntity> q = Query(context, filter);

        var rows = await q
            .Join(context.Set<AgentVersionEntity>().AsNoTracking(),
                c => c.AgentVersionId, v => v.Id,
                (c, v) => new { v.AgentId })
            .GroupBy(x => x.AgentId)
            .Select(g => new AgentBreakdownStat(g.Key, g.Count()))
            .ToListAsync(cancellationToken);

        return rows.OrderByDescending(r => r.CallCount).ThenBy(r => r.AgentId).ToArray();
    }

    public async Task<IReadOnlyList<CostEstimateStat>> GetCostEstimateAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
    {
        StorageDbContext context = contextFactory();
        IQueryable<AgentCallEntity> q = Query(context, filter);

        var rows = await q
            .GroupBy(c => c.EndpointId)
            .Select(g => new
            {
                EndpointId = g.Key,
                TotalInput = g.Sum(c => (long?)c.InputTokens ?? 0L),
                TotalOutput = g.Sum(c => (long?)c.OutputTokens ?? 0L),
            })
            .ToListAsync(cancellationToken);

        Dictionary<Guid, IModelEndpoint> endpoints = await LoadEndpointsAsync(
            context, rows.Select(r => r.EndpointId).ToArray(), cancellationToken);

        return rows
            .Select(r =>
            {
                IModelEndpoint? endpoint = endpoints.GetValueOrDefault(r.EndpointId);
                if (endpoint?.InputTokenCost is null && endpoint?.OutputTokenCost is null)
                {
                    return new CostEstimateStat(r.EndpointId, null, null, null);
                }

                decimal? input = endpoint.InputTokenCost is { } ic ? ic * r.TotalInput : null;
                decimal? output = endpoint.OutputTokenCost is { } oc ? oc * r.TotalOutput : null;
                decimal? total = (input ?? 0m) + (output ?? 0m);
                return new CostEstimateStat(r.EndpointId, input, output, total);
            })
            .OrderBy(s => s.EndpointId)
            .ToArray();
    }

    public async Task<IReadOnlyList<AgentTokenUsageStat>> GetTokenUsageByAgentAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
    {
        StorageDbContext context = contextFactory();
        IQueryable<AgentCallEntity> q = Query(context, filter);

        var raw = await q
            .Join(context.Set<AgentVersionEntity>().AsNoTracking(),
                c => c.AgentVersionId, v => v.Id,
                (c, v) => new { c.CreatedAt, v.AgentId, c.InputTokens, c.OutputTokens })
            .ToListAsync(cancellationToken);

        return raw
            .GroupBy(c => new { Date = DateOnly.FromDateTime(c.CreatedAt.UtcDateTime), c.AgentId })
            .Select(g => new AgentTokenUsageStat(
                Date: g.Key.Date,
                AgentId: g.Key.AgentId,
                InputTokens: g.Sum(c => (long?)c.InputTokens ?? 0L),
                OutputTokens: g.Sum(c => (long?)c.OutputTokens ?? 0L)))
            .OrderBy(s => s.Date)
            .ThenBy(s => s.AgentId)
            .ToArray();
    }

    public async Task<LiveTelemetry> GetLiveTelemetryAsync(StatisticsFilter filter, DateTimeOffset since, DateTimeOffset now, CancellationToken cancellationToken = default)
    {
        StorageDbContext context = contextFactory();
        IQueryable<AgentCallEntity> q = Query(context, filter)
            .Where(c => c.CreatedAt >= since && c.CreatedAt <= now);

        var rows = await q
            .Select(c => new { c.LatencyMs, c.InputTokens, c.OutputTokens, c.HttpStatus })
            .ToListAsync(cancellationToken);

        double windowMinutes = Math.Max((now - since).TotalMinutes, 1d);
        double windowSeconds = Math.Max((now - since).TotalSeconds, 1d);
        long tokens = rows.Sum(r => ((long?)r.InputTokens ?? 0L) + ((long?)r.OutputTokens ?? 0L));
        int total = rows.Count;
        int errors = rows.Count(r => r.HttpStatus >= 400);
        double[] sorted = rows.Where(r => r.LatencyMs != null).Select(r => r.LatencyMs ?? 0d).OrderBy(v => v).ToArray();

        return new LiveTelemetry(
            TracesPerMinute: total / windowMinutes,
            TokensPerSecond: tokens / windowSeconds,
            QueueDepth: 0,
            ErrorRate: total == 0 ? 0d : errors / (double)total,
            P95Ms: Percentile(sorted, 0.95),
            ProxyVersion: string.Empty);
    }

    public async Task<CallTrends> GetCallTrendsAsync(StatisticsFilter filter, int buckets, DateTimeOffset from, DateTimeOffset to, CancellationToken cancellationToken = default)
    {
        buckets = Math.Max(buckets, 1);
        StorageDbContext context = contextFactory();
        IQueryable<AgentCallEntity> q = Query(context, filter)
            .Where(c => c.CreatedAt >= from && c.CreatedAt <= to);

        var rows = await q
            .Select(c => new { c.CreatedAt, c.LatencyMs, c.InputTokens, c.OutputTokens })
            .ToListAsync(cancellationToken);

        double bucketSeconds = Math.Max((to - from).TotalSeconds, 1d) / buckets;
        var traces = new double[buckets];
        var latencySum = new double[buckets];
        var latencyCount = new int[buckets];
        var tokenSum = new double[buckets];

        foreach (var r in rows)
        {
            int idx = (int)((r.CreatedAt - from).TotalSeconds / bucketSeconds);
            idx = Math.Clamp(idx, 0, buckets - 1);
            traces[idx] += 1;
            tokenSum[idx] += ((long?)r.InputTokens ?? 0L) + ((long?)r.OutputTokens ?? 0L);
            if (r.LatencyMs is { } latency)
            {
                latencySum[idx] += latency;
                latencyCount[idx] += 1;
            }
        }

        var latencyMs = new double[buckets];
        var throughput = new double[buckets];
        for (int i = 0; i < buckets; i++)
        {
            latencyMs[i] = latencyCount[i] > 0 ? latencySum[i] / latencyCount[i] : 0d;
            throughput[i] = tokenSum[i] / bucketSeconds;
        }

        return new CallTrends(traces, latencyMs, throughput);
    }

    public async Task<IReadOnlyList<AgentTimeSeriesPoint>> GetAgentTimeSeriesAsync(
        Guid agentId,
        DateTimeOffset from,
        DateTimeOffset to,
        StatisticsBucket bucket,
        CancellationToken cancellationToken = default)
    {
        (IReadOnlyList<AgentTimeSeriesPoint> series, _) = await GetAgentWindowAsync(agentId, from, to, bucket, cancellationToken);
        return series;
    }

    public async Task<(IReadOnlyList<AgentTimeSeriesPoint> Series, AgentTimeSummary Summary)> GetAgentWindowAsync(
        Guid agentId,
        DateTimeOffset from,
        DateTimeOffset to,
        StatisticsBucket bucket,
        CancellationToken cancellationToken = default)
    {
        StorageDbContext context = contextFactory();

        var versionIdsForAgent = context.Set<AgentVersionEntity>()
            .AsNoTracking()
            .Where(v => v.AgentId == agentId)
            .Select(v => v.Id);
        List<AgentCallEntity> rows = await context.Set<AgentCallEntity>()
            .AsNoTracking()
            .Where(c => versionIdsForAgent.Contains(c.AgentVersionId) && c.CreatedAt >= from && c.CreatedAt <= to)
            .ToListAsync(cancellationToken);

        Dictionary<Guid, IModelEndpoint> endpoints = await LoadEndpointsAsync(
            context, rows.Select(r => r.EndpointId).Distinct().ToArray(), cancellationToken);

        AgentTimeSeriesPoint[] series = rows
            .GroupBy(r => bucket.BucketStart(r.CreatedAt))
            .OrderBy(g => g.Key)
            .Select(g => new AgentTimeSeriesPoint(
                BucketStart: g.Key,
                TraceCount: g.Count(),
                InputTokens: g.Sum(r => (long?)r.InputTokens ?? 0L),
                OutputTokens: g.Sum(r => (long?)r.OutputTokens ?? 0L),
                CostEur: SumCost(g, endpoints),
                AvgLatencyMs: g.Average(r => r.LatencyMs ?? 0d)))
            .ToArray();

        long totalInput = rows.Sum(r => (long?)r.InputTokens ?? 0L);
        long totalOutput = rows.Sum(r => (long?)r.OutputTokens ?? 0L);
        double avgLatency = rows.Count == 0 ? 0d : rows.Average(r => r.LatencyMs ?? 0d);
        decimal totalCost = SumCost(rows, endpoints);

        AgentTimeSummary summary = new(
            TotalTraces: rows.Count,
            TotalInputTokens: totalInput,
            TotalOutputTokens: totalOutput,
            TotalCostEur: totalCost,
            AvgLatencyMs: avgLatency);

        return (series, summary);
    }

    private async Task<Dictionary<Guid, IModelEndpoint>> LoadEndpointsAsync(
        StorageDbContext context, IReadOnlyCollection<Guid> endpointIds, CancellationToken cancellationToken)
    {
        if (endpointIds.Count == 0)
        {
            return new Dictionary<Guid, IModelEndpoint>();
        }

        List<ModelEndpointEntity> entities = await context.Set<ModelEndpointEntity>()
            .AsNoTracking()
            .Where(e => endpointIds.Contains(e.Id))
            .ToListAsync(cancellationToken);

        var result = new Dictionary<Guid, IModelEndpoint>(entities.Count);
        foreach (ModelEndpointEntity entity in entities)
        {
            result[entity.Id] = await endpointMapper.Map(entity, cancellationToken);
        }
        return result;
    }

    private static async Task<Dictionary<Guid, string>> LoadModelNamesAsync(
        StorageDbContext context, IReadOnlyCollection<Guid> endpointIds, CancellationToken cancellationToken)
    {
        if (endpointIds.Count == 0)
        {
            return new Dictionary<Guid, string>();
        }

        var pairs = await context.Set<ModelEndpointEntity>()
            .AsNoTracking()
            .Where(e => endpointIds.Contains(e.Id))
            .Join(context.Set<ModelEntity>().AsNoTracking(),
                e => e.Model,
                m => m.Id,
                (e, m) => new { EndpointId = e.Id, m.Name })
            .ToListAsync(cancellationToken);

        return pairs.ToDictionary(p => p.EndpointId, p => p.Name);
    }

    private static decimal SumCost(IEnumerable<AgentCallEntity> calls, IReadOnlyDictionary<Guid, IModelEndpoint> endpoints)
    {
        decimal total = 0m;
        foreach (AgentCallEntity call in calls)
        {
            if (!endpoints.TryGetValue(call.EndpointId, out IModelEndpoint? endpoint)
                || !call.InputTokens.HasValue
                || !call.OutputTokens.HasValue)
            {
                continue;
            }
            TokenUsage usage = new(call.InputTokens.Value, call.OutputTokens.Value);
            decimal? cost = endpoint.CalculateCost(usage);
            if (cost.HasValue)
            {
                total += cost.Value;
            }
        }
        return total;
    }

    private static IQueryable<AgentCallEntity> Query(StorageDbContext context, StatisticsFilter filter)
    {
        IQueryable<AgentCallEntity> query = context.Set<AgentCallEntity>().AsNoTracking();

        if (filter.AgentId is { } agentId)
        {
            IQueryable<Guid> versionIdsForAgent = context.Set<AgentVersionEntity>()
                .AsNoTracking()
                .Where(v => v.AgentId == agentId)
                .Select(v => v.Id);
            query = query.Where(c => versionIdsForAgent.Contains(c.AgentVersionId));
        }
        if (filter.EndpointId is { } endpointId)
        {
            query = query.Where(c => c.EndpointId == endpointId);
        }
        if (filter.ProjectId is { } projectId)
        {
            IQueryable<Guid> versionIdsForProject = context.Set<AgentVersionEntity>()
                .AsNoTracking()
                .Where(v => v.Project == projectId)
                .Select(v => v.Id);
            query = query.Where(c => versionIdsForProject.Contains(c.AgentVersionId));
        }
        if (filter.From is { } from)
        {
            query = query.Where(c => c.CreatedAt >= from);
        }
        if (filter.To is { } to)
        {
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
}
