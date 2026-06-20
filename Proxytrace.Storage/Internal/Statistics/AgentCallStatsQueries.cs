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
                Cached = g.Sum(c => (long?)c.CachedInputTokens ?? 0L),
                AvgLatency = g.Average(c => c.LatencyMs ?? 0d),
            })
            .FirstOrDefaultAsync(cancellationToken);

        return new StatisticsSummary(
            TotalCalls: agg?.Count ?? 0L,
            TotalInputTokens: agg?.Input ?? 0L,
            TotalOutputTokens: agg?.Output ?? 0L,
            TotalCachedInputTokens: agg?.Cached ?? 0L,
            AvgLatencyMs: agg?.AvgLatency ?? 0d,
            OverallPassRate: null);
    }

    public async Task<DateTimeOffset?> GetEarliestCallAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
    {
        StorageDbContext context = contextFactory();
        return await Query(context, filter)
            .OrderBy(c => c.CreatedAt)
            .Select(c => (DateTimeOffset?)c.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<TokenUsageStat>> GetTokenUsageAsync(StatisticsFilter filter, StatisticsBucket bucket, CancellationToken cancellationToken = default)
    {
        StorageDbContext context = contextFactory();
        IQueryable<AgentCallEntity> q = Query(context, filter);

        double widthMs = bucket.WidthMilliseconds();

        // Aggregate per (bucket, endpoint) in the database: only one row per non-empty bucket
        // crosses the wire — O(buckets × endpoints), never O(rows). See StatisticsTime.WidthMilliseconds.
        var rows = await q
            .GroupBy(c => new
            {
                Bucket = (int)Math.Floor((c.CreatedAt - DateTimeOffset.UnixEpoch).TotalMilliseconds / widthMs),
                c.EndpointId,
            })
            .Select(g => new
            {
                g.Key.Bucket,
                g.Key.EndpointId,
                Input = g.Sum(c => (long?)c.InputTokens ?? 0L),
                Output = g.Sum(c => (long?)c.OutputTokens ?? 0L),
                Cached = g.Sum(c => (long?)c.CachedInputTokens ?? 0L),
            })
            .ToListAsync(cancellationToken);

        return rows
            .Select(r => new TokenUsageStat(
                BucketStart: bucket.BucketStartFromIndex(r.Bucket),
                EndpointId: r.EndpointId,
                InputTokens: r.Input,
                OutputTokens: r.Output,
                CachedInputTokens: r.Cached))
            .OrderBy(s => s.BucketStart)
            .ThenBy(s => s.EndpointId)
            .ToArray();
    }

    public async Task<IReadOnlyList<LatencyStat>> GetLatencyAsync(StatisticsFilter filter, CancellationToken cancellationToken = default)
    {
        StorageDbContext context = contextFactory();

        // Percentiles need the full ordered distribution. On a relational provider we compute them
        // server-side with percentile_cont so only one row per endpoint crosses the wire; pulling
        // every latency into memory and sorting there does not scale to millions of calls. The
        // in-memory provider (kiosk/tests) cannot translate ordered-set aggregates, so it keeps the
        // materialise-and-sort path — its datasets are small. Mirrors RemoveOlderThanAsync.
        if (context.Database.IsRelational())
        {
            return await GetLatencyRelationalAsync(context, filter, cancellationToken);
        }

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

    private async Task<IReadOnlyList<LatencyStat>> GetLatencyRelationalAsync(
        StorageDbContext context, StatisticsFilter filter, CancellationToken cancellationToken)
    {
        var (where, parameters) = BuildLatencyWhere(context, filter);
        string sql = $"""
            SELECT "EndpointId",
                   count(*) AS cnt,
                   min("LatencyMs") AS mn,
                   max("LatencyMs") AS mx,
                   percentile_cont(0.5)  WITHIN GROUP (ORDER BY "LatencyMs") AS p50,
                   percentile_cont(0.95) WITHIN GROUP (ORDER BY "LatencyMs") AS p95,
                   percentile_cont(0.99) WITHIN GROUP (ORDER BY "LatencyMs") AS p99
            FROM "AgentCallEntity"
            WHERE "LatencyMs" IS NOT NULL{where}
            GROUP BY "EndpointId"
            ORDER BY "EndpointId"
            """;

        var result = new List<LatencyStat>();
        await using var command = context.Database.GetDbConnection().CreateCommand();
        command.CommandText = sql;
        foreach (var (name, value) in parameters)
        {
            var p = command.CreateParameter();
            p.ParameterName = name;
            p.Value = value;
            command.Parameters.Add(p);
        }

        await context.Database.OpenConnectionAsync(cancellationToken);
        try
        {
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                result.Add(new LatencyStat(
                    EndpointId: reader.GetGuid(0),
                    P50Ms: reader.GetDouble(4),
                    P95Ms: reader.GetDouble(5),
                    P99Ms: reader.GetDouble(6),
                    MinMs: reader.GetDouble(2),
                    MaxMs: reader.GetDouble(3),
                    SampleCount: (int)reader.GetInt64(1)));
            }
        }
        finally
        {
            await context.Database.CloseConnectionAsync();
        }
        return result;
    }

    /// <summary>
    /// Builds the parameterised <c>WHERE</c> fragment (and its parameters) mirroring
    /// <see cref="Query"/> for the raw-SQL percentile paths. Kept in lockstep with the table/column
    /// names in <c>AgentCallConfig</c>/<c>AgentVersionConfig</c>.
    /// </summary>
    private static (string Where, IReadOnlyList<(string Name, object Value)> Parameters) BuildLatencyWhere(
        StorageDbContext context, StatisticsFilter filter)
    {
        var clauses = new List<string>();
        var parameters = new List<(string, object)>();

        if (filter.AgentId is { } agentId)
        {
            clauses.Add("\"AgentVersionId\" IN (SELECT \"Id\" FROM \"AgentVersionEntity\" WHERE \"AgentId\" = @agentId)");
            parameters.Add(("@agentId", agentId));
        }
        if (filter.ProjectId is { } projectId)
        {
            clauses.Add("\"AgentVersionId\" IN (SELECT \"Id\" FROM \"AgentVersionEntity\" WHERE \"Project\" = @projectId)");
            parameters.Add(("@projectId", projectId));
        }
        if (filter.EndpointId is { } endpointId)
        {
            clauses.Add("\"EndpointId\" = @endpointId");
            parameters.Add(("@endpointId", endpointId));
        }
        if (filter.From is { } from)
        {
            clauses.Add("\"CreatedAt\" >= @from");
            parameters.Add(("@from", from));
        }
        if (filter.To is { } to)
        {
            clauses.Add("\"CreatedAt\" <= @to");
            parameters.Add(("@to", to));
        }

        string where = clauses.Count == 0 ? string.Empty : " AND " + string.Join(" AND ", clauses);
        return (where, parameters);
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
                TotalCached = g.Sum(c => (long?)c.CachedInputTokens ?? 0L),
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
                TotalCachedInputTokens: r.TotalCached,
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
                TotalCached = g.Sum(c => (long?)c.CachedInputTokens ?? 0L),
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

                // Cached input is a subset of the input tokens, priced at the cheaper cached rate
                // (falling back to the input rate when no cached price is configured). Per-token
                // prices are EUR per 1M tokens, so divide by 1M to match ModelEndpoint.CalculateCost.
                long cached = Math.Min(r.TotalCached, r.TotalInput);
                decimal? input = endpoint.InputTokenCost is { } ic
                    ? (ic * (r.TotalInput - cached) + (endpoint.CachedInputTokenCost ?? ic) * cached) / 1_000_000m
                    : null;
                decimal? output = endpoint.OutputTokenCost is { } oc ? oc * r.TotalOutput / 1_000_000m : null;
                decimal? total = (input ?? 0m) + (output ?? 0m);
                return new CostEstimateStat(r.EndpointId, input, output, total);
            })
            .OrderBy(s => s.EndpointId)
            .ToArray();
    }

    public async Task<IReadOnlyList<AgentTokenUsageStat>> GetTokenUsageByAgentAsync(StatisticsFilter filter, StatisticsBucket bucket, CancellationToken cancellationToken = default)
    {
        StorageDbContext context = contextFactory();
        IQueryable<AgentCallEntity> q = Query(context, filter);

        double widthMs = bucket.WidthMilliseconds();

        var rows = await q
            .Join(context.Set<AgentVersionEntity>().AsNoTracking(),
                c => c.AgentVersionId, v => v.Id,
                (c, v) => new { c.CreatedAt, v.AgentId, c.InputTokens, c.OutputTokens, c.CachedInputTokens })
            .GroupBy(x => new
            {
                Bucket = (int)Math.Floor((x.CreatedAt - DateTimeOffset.UnixEpoch).TotalMilliseconds / widthMs),
                x.AgentId,
            })
            .Select(g => new
            {
                g.Key.Bucket,
                g.Key.AgentId,
                Input = g.Sum(x => (long?)x.InputTokens ?? 0L),
                Output = g.Sum(x => (long?)x.OutputTokens ?? 0L),
                Cached = g.Sum(x => (long?)x.CachedInputTokens ?? 0L),
            })
            .ToListAsync(cancellationToken);

        return rows
            .Select(r => new AgentTokenUsageStat(
                BucketStart: bucket.BucketStartFromIndex(r.Bucket),
                AgentId: r.AgentId,
                InputTokens: r.Input,
                OutputTokens: r.Output,
                CachedInputTokens: r.Cached))
            .OrderBy(s => s.BucketStart)
            .ThenBy(s => s.AgentId)
            .ToArray();
    }

    public async Task<LiveTelemetry> GetLiveTelemetryAsync(StatisticsFilter filter, DateTimeOffset since, DateTimeOffset now, CancellationToken cancellationToken = default)
    {
        StorageDbContext context = contextFactory();
        // Live telemetry is always the [since, now] window. Build the query from a filter whose
        // From/To are pinned to that window so the scalar rollups and the percentile path below see
        // exactly the same rows (rather than also re-applying the caller's own From/To).
        StatisticsFilter windowFilter = filter with { From = since, To = now };
        IQueryable<AgentCallEntity> q = Query(context, windowFilter);

        // Scalar rollups (count / error count / token sum) aggregate server-side in a single row.
        var agg = await q
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Total = g.Count(),
                Errors = g.Count(c => c.HttpStatus >= 400),
                Tokens = g.Sum(c => ((long?)c.InputTokens ?? 0L) + ((long?)c.OutputTokens ?? 0L)),
            })
            .FirstOrDefaultAsync(cancellationToken);

        double windowMinutes = Math.Max((now - since).TotalMinutes, 1d);
        double windowSeconds = Math.Max((now - since).TotalSeconds, 1d);
        int total = agg?.Total ?? 0;
        int errors = agg?.Errors ?? 0;
        long tokens = agg?.Tokens ?? 0L;

        double p95;
        if (context.Database.IsRelational())
        {
            p95 = await GetWindowPercentileRelationalAsync(context, windowFilter, 0.95, cancellationToken);
        }
        else
        {
            double[] sorted = await q
                .Where(c => c.LatencyMs != null)
                .Select(c => c.LatencyMs ?? 0d)
                .OrderBy(v => v)
                .ToArrayAsync(cancellationToken);
            p95 = Percentile(sorted, 0.95);
        }

        return new LiveTelemetry(
            TracesPerMinute: total / windowMinutes,
            TokensPerSecond: tokens / windowSeconds,
            QueueDepth: 0,
            ErrorRate: total == 0 ? 0d : errors / (double)total,
            P95Ms: p95,
            ProxyVersion: string.Empty);
    }

    private async Task<double> GetWindowPercentileRelationalAsync(
        StorageDbContext context, StatisticsFilter filter, double percentile, CancellationToken cancellationToken)
    {
        var (where, parameters) = BuildLatencyWhere(context, filter);
        string sql = $"""
            SELECT percentile_cont({percentile.ToString(System.Globalization.CultureInfo.InvariantCulture)})
                   WITHIN GROUP (ORDER BY "LatencyMs")
            FROM "AgentCallEntity"
            WHERE "LatencyMs" IS NOT NULL{where}
            """;

        await using var command = context.Database.GetDbConnection().CreateCommand();
        command.CommandText = sql;
        foreach (var (name, value) in parameters)
        {
            var p = command.CreateParameter();
            p.ParameterName = name;
            p.Value = value;
            command.Parameters.Add(p);
        }

        await context.Database.OpenConnectionAsync(cancellationToken);
        try
        {
            object? scalar = await command.ExecuteScalarAsync(cancellationToken);
            return scalar is double d ? d : 0d;
        }
        finally
        {
            await context.Database.CloseConnectionAsync();
        }
    }

    public async Task<CallTrends> GetCallTrendsAsync(StatisticsFilter filter, int buckets, DateTimeOffset from, DateTimeOffset to, CancellationToken cancellationToken = default)
    {
        buckets = Math.Max(buckets, 1);
        StorageDbContext context = contextFactory();
        IQueryable<AgentCallEntity> q = Query(context, filter)
            .Where(c => c.CreatedAt >= from && c.CreatedAt <= to);

        double bucketMs = Math.Max((to - from).TotalMilliseconds, 1d) / buckets;
        double bucketSeconds = bucketMs / 1000d;

        // Bucket-and-aggregate in the database (same integer-slot GROUP BY as the histogram), so at
        // most one row per non-empty bucket returns instead of every matching call.
        var grouped = await q
            .GroupBy(c => (int)Math.Floor((c.CreatedAt - from).TotalMilliseconds / bucketMs))
            .Select(g => new
            {
                Index = g.Key,
                Count = g.Count(),
                LatencySum = g.Sum(c => c.LatencyMs ?? 0d),
                LatencyCount = g.Count(c => c.LatencyMs != null),
                TokenSum = g.Sum(c => ((long?)c.InputTokens ?? 0L) + ((long?)c.OutputTokens ?? 0L)),
            })
            .ToListAsync(cancellationToken);

        var traces = new double[buckets];
        var latencySum = new double[buckets];
        var latencyCount = new int[buckets];
        var tokenSum = new double[buckets];

        foreach (var g in grouped)
        {
            int idx = Math.Clamp(g.Index, 0, buckets - 1);
            traces[idx] += g.Count;
            tokenSum[idx] += g.TokenSum;
            latencySum[idx] += g.LatencySum;
            latencyCount[idx] += g.LatencyCount;
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
        double widthMs = bucket.WidthMilliseconds();

        var versionIdsForAgent = context.Set<AgentVersionEntity>()
            .AsNoTracking()
            .Where(v => v.AgentId == agentId)
            .Select(v => v.Id);

        // Aggregate per (bucket, endpoint) in the database. The endpoint split lets us cost each
        // bucket from per-model token sums (CalculateCost is linear in tokens) without ever pulling
        // raw rows into memory — the result set is O(buckets × endpoints), not O(calls).
        var grouped = await context.Set<AgentCallEntity>()
            .AsNoTracking()
            .Where(c => versionIdsForAgent.Contains(c.AgentVersionId) && c.CreatedAt >= from && c.CreatedAt <= to)
            .GroupBy(c => new
            {
                Bucket = (int)Math.Floor((c.CreatedAt - DateTimeOffset.UnixEpoch).TotalMilliseconds / widthMs),
                c.EndpointId,
            })
            .Select(g => new
            {
                g.Key.Bucket,
                g.Key.EndpointId,
                Count = g.Count(),
                Input = g.Sum(c => (long?)c.InputTokens ?? 0L),
                Output = g.Sum(c => (long?)c.OutputTokens ?? 0L),
                Cached = g.Sum(c => (long?)c.CachedInputTokens ?? 0L),
                LatencySum = g.Sum(c => c.LatencyMs ?? 0d),
            })
            .ToListAsync(cancellationToken);

        Dictionary<Guid, IModelEndpoint> endpoints = await LoadEndpointsAsync(
            context, grouped.Select(r => r.EndpointId).Distinct().ToArray(), cancellationToken);

        decimal CostOf(Guid endpointId, long input, long output, long cached)
            => endpoints.TryGetValue(endpointId, out IModelEndpoint? e)
                ? e.CalculateCost(new TokenUsage(
                    (ulong)Math.Max(input, 0L), (ulong)Math.Max(output, 0L), (ulong)Math.Max(cached, 0L))) ?? 0m
                : 0m;

        AgentTimeSeriesPoint[] series = grouped
            .GroupBy(r => r.Bucket)
            .OrderBy(g => g.Key)
            .Select(g =>
            {
                int count = g.Sum(r => r.Count);
                return new AgentTimeSeriesPoint(
                    BucketStart: bucket.BucketStartFromIndex(g.Key),
                    TraceCount: count,
                    InputTokens: g.Sum(r => r.Input),
                    OutputTokens: g.Sum(r => r.Output),
                    CachedInputTokens: g.Sum(r => r.Cached),
                    CostEur: g.Sum(r => CostOf(r.EndpointId, r.Input, r.Output, r.Cached)),
                    AvgLatencyMs: count == 0 ? 0d : g.Sum(r => r.LatencySum) / count);
            })
            .ToArray();

        int totalTraces = grouped.Sum(r => r.Count);
        AgentTimeSummary summary = new(
            TotalTraces: totalTraces,
            TotalInputTokens: grouped.Sum(r => r.Input),
            TotalOutputTokens: grouped.Sum(r => r.Output),
            TotalCachedInputTokens: grouped.Sum(r => r.Cached),
            TotalCostEur: grouped.Sum(r => CostOf(r.EndpointId, r.Input, r.Output, r.Cached)),
            AvgLatencyMs: totalTraces == 0 ? 0d : grouped.Sum(r => r.LatencySum) / totalTraces);

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
