using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Trsr.Application.Statistics;
using Trsr.Domain.Evaluation;
using Trsr.Storage.Internal.Entities.Evaluator;
using Trsr.Storage.Internal.Entities.TestResult;

namespace Trsr.Storage.Internal.Statistics;

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
                    .GroupBy(x => bucket.BucketStart(x.Timestamp))
                    .OrderBy(g => g.Key)
                    .Select(g => new EvaluatorPassRatePoint(
                        BucketStart: g.Key,
                        Passed: g.Count(x => IsPassed(x.Eval.Score)),
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
        int total = matching.Length;
        double? avgScore = total > 0 ? matching.Average(x => (double)(byte)x.Eval.Score) : null;
        int passedCount = matching.Count(x => IsPassed(x.Eval.Score));
        double? passRate = total > 0 ? passedCount / (double)total : null;

        // Token usage and cost are not captured per-evaluation; the underlying judge LLM call is
        // logged as a separate AgentCall against the evaluator's system agent. Attribution back to
        // a specific evaluation is not yet wired, so leave these null until that link exists.
        var summary = new EvaluatorSummary(
            TotalEvaluations: total,
            AvgScore: avgScore,
            OverallPassRate: passRate,
            InputTokens: null,
            OutputTokens: null,
            TotalCostEur: null);

        EvaluatorPassRatePoint[] trend = matching
            .GroupBy(x => bucket.BucketStart(x.Timestamp))
            .OrderBy(g => g.Key)
            .Select(g => new EvaluatorPassRatePoint(
                BucketStart: g.Key,
                Passed: g.Count(x => IsPassed(x.Eval.Score)),
                Total: g.Count()))
            .ToArray();

        EvaluatorScoreBucket[] distribution = matching
            .GroupBy(x => x.Eval.Score)
            .OrderBy(g => (byte)g.Key)
            .Select(g => new EvaluatorScoreBucket(g.Key.ToString(), g.Count()))
            .ToArray();

        return new EvaluatorOverviewStat(summary, trend, distribution);
    }

    private static bool IsPassed(EvaluationScore score) => (byte)score >= (byte)EvaluationScore.Acceptable;
}
