using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Proxytrace.Application.Statistics;
using Proxytrace.Domain.Evaluation;
using Proxytrace.Storage.Internal.Entities.Evaluator;
using Proxytrace.Storage.Internal.Entities.TestResult;

namespace Proxytrace.Storage.Internal.Statistics;

[UsedImplicitly]
internal class EvaluatorStatsQueries : IEvaluatorStatsReader
{
    private readonly Func<StorageDbContext> contextFactory;

    public EvaluatorStatsQueries(Func<StorageDbContext> contextFactory)
    {
        this.contextFactory = contextFactory;
    }

    public async Task<EvaluatorOverviewStat> GetOverviewAsync(
        Guid evaluatorId,
        DateTimeOffset from,
        DateTimeOffset to,
        StatisticsBucket bucket,
        CancellationToken cancellationToken = default)
    {
        StorageDbContext context = contextFactory();

        // Evaluations are stored as a JSON-converted collection on TestResultEntity, so we cannot
        // filter inside SQL. Load (CreatedAt, Evaluations) for the window, then expand in memory.
        var rows = await context.Set<TestResultEntity>()
            .AsNoTracking()
            .Where(t => t.CreatedAt >= from && t.CreatedAt <= to)
            .Select(t => new { t.CreatedAt, t.Evaluations })
            .ToListAsync(cancellationToken);

        var matching = rows
            .SelectMany(r => r.Evaluations.Select(e => (Timestamp: r.CreatedAt, Eval: e)))
            .Where(x => x.Eval.EvaluatorId == evaluatorId)
            .ToArray();

        return BuildOverview(matching, bucket);
    }

    public async Task<IReadOnlyList<EvaluatorSparklineStat>> GetSparklinesAsync(
        Guid projectId,
        DateTimeOffset from,
        DateTimeOffset to,
        StatisticsBucket bucket,
        CancellationToken cancellationToken = default)
    {
        StorageDbContext context = contextFactory();

        Guid[] evaluatorIds = await context.Set<EvaluatorEntity>()
            .AsNoTracking()
            .Where(e => e.Project == projectId)
            .Select(e => e.Id)
            .ToArrayAsync(cancellationToken);

        if (evaluatorIds.Length == 0)
        {
            return [];
        }

        var rows = await context.Set<TestResultEntity>()
            .AsNoTracking()
            .Where(t => t.CreatedAt >= from && t.CreatedAt <= to)
            .Select(t => new { t.CreatedAt, t.Evaluations })
            .ToListAsync(cancellationToken);

        var evaluatorIdSet = evaluatorIds.ToHashSet();

        var byEvaluator = rows
            .SelectMany(r => r.Evaluations.Select(e => (Timestamp: r.CreatedAt, Eval: e)))
            .Where(x => evaluatorIdSet.Contains(x.Eval.EvaluatorId))
            .GroupBy(x => x.Eval.EvaluatorId)
            .ToDictionary(g => g.Key, g => g.ToArray());

        return evaluatorIds
            .Select(id =>
            {
                if (!byEvaluator.TryGetValue(id, out var entries))
                {
                    return new EvaluatorSparklineStat(id, []);
                }

                EvaluatorPassRatePoint[] points = entries
                    .Where(x => x.Eval is { ErrorMessage: null, Score: not null })
                    .GroupBy(x => bucket.BucketStart(x.Timestamp))
                    .OrderBy(g => g.Key)
                    .Select(g => new EvaluatorPassRatePoint(
                        BucketStart: g.Key,
                        Passed: g.Count(x => IsPassed(x.Eval.Score ?? 0)),
                        Total: g.Count()))
                    .ToArray();

                return new EvaluatorSparklineStat(id, points);
            })
            .ToArray();
    }

    private static EvaluatorOverviewStat BuildOverview(
        (DateTimeOffset Timestamp, StoredEvaluation Eval)[] matching,
        StatisticsBucket bucket)
    {
        var succeeded = matching
            .Where(x => x.Eval.Score.HasValue)
            .ToArray();
        int total = succeeded.Length;
        double? avgScore = total > 0 ? succeeded.Average(x => (double)(byte)(x.Eval.Score ?? 0)) : null;
        int passedCount = succeeded.Count(x => IsPassed(x.Eval.Score ?? 0));
        double? passRate = total > 0 ? passedCount / (double)total : null;

        var withTokens = matching.Where(x => x.Eval is { InputTokens: not null, OutputTokens: not null }).ToArray();
        long? inputTokens = withTokens.Length > 0 ? withTokens.Sum(x => x.Eval.InputTokens ?? 0) : null;
        long? outputTokens = withTokens.Length > 0 ? withTokens.Sum(x => x.Eval.OutputTokens ?? 0) : null;

        var withCost = matching.Where(x => x.Eval.Cost.HasValue).ToArray();
        decimal? totalCost = withCost.Length > 0 ? withCost.Sum(x => x.Eval.Cost ?? 0) : null;

        double? avgLatencyMs = matching.Length > 0
            ? matching.Average(x => x.Eval.LatencyMicroseconds / 1_000.0)
            : null;

        var summary = new EvaluatorSummary(
            TotalEvaluations: total,
            AvgScore: avgScore,
            OverallPassRate: passRate,
            InputTokens: inputTokens,
            OutputTokens: outputTokens,
            TotalCost: totalCost,
            AvgLatencyMs: avgLatencyMs);

        EvaluatorPassRatePoint[] trend = succeeded
            .GroupBy(x => bucket.BucketStart(x.Timestamp))
            .OrderBy(g => g.Key)
            .Select(g => new EvaluatorPassRatePoint(
                BucketStart: g.Key,
                Passed: g.Count(x => IsPassed(x.Eval.Score ?? 0)),
                Total: g.Count()))
            .ToArray();

        EvaluatorScoreBucket[] distribution = succeeded
            .Where(x => x.Eval.Score.HasValue)
            .GroupBy(x => x.Eval.Score ?? 0)
            .OrderBy(g => (byte)g.Key)
            .Select(g => new EvaluatorScoreBucket(g.Key.ToString(), g.Count()))
            .ToArray();

        EvaluatorCostPoint[] costTrend = matching
            .GroupBy(x => bucket.BucketStart(x.Timestamp))
            .OrderBy(g => g.Key)
            .Select(g => new EvaluatorCostPoint(
                BucketStart: g.Key,
                InputTokens: g.Sum(x => x.Eval.InputTokens ?? 0),
                OutputTokens: g.Sum(x => x.Eval.OutputTokens ?? 0),
                Cost: g.Sum(x => x.Eval.Cost ?? 0m),
                AvgLatencyMs: g.Average(x => x.Eval.LatencyMicroseconds / 1_000.0)))
            .ToArray();

        return new EvaluatorOverviewStat(summary, trend, distribution, costTrend);
    }

    private static bool IsPassed(EvaluationScore score) => (byte)score >= (byte)EvaluationScore.Acceptable;
}
