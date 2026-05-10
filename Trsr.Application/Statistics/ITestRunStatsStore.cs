namespace Trsr.Application.Statistics;

/// <summary>
/// Storage contract for per-run statistics projections. Owned by the Statistics sub-module;
/// the EF entity that backs it is internal to <c>Trsr.Storage</c>.
/// </summary>
public interface ITestRunStatsStore
{
    Task UpsertAsync(TestRunStats stats, CancellationToken cancellationToken = default);

    Task DeleteAsync(Guid testRunId, CancellationToken cancellationToken = default);

    Task<TestRunStats?> GetByTestRunIdAsync(Guid testRunId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<TestRunStats>> QueryAsync(TestRunStatsFilter filter, CancellationToken cancellationToken = default);
}
