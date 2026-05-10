namespace Trsr.Application.Statistics;

/// <summary>
/// Storage-side projection of evaluation results into evaluator-scoped statistics.
/// </summary>
public interface IEvaluatorStatsReader
{
    Task<EvaluatorOverviewStat> GetOverviewAsync(
        Guid evaluatorId,
        DateTimeOffset from,
        DateTimeOffset to,
        StatisticsBucket bucket,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<EvaluatorSparklineStat>> GetSparklinesAsync(
        Guid projectId,
        DateTimeOffset from,
        DateTimeOffset to,
        StatisticsBucket bucket,
        CancellationToken cancellationToken = default);
}
