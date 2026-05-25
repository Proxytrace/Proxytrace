namespace Proxytrace.Application.Statistics;

/// <summary>
/// Read access to per-run statistics projections. Consumed by <see cref="IStatisticsService"/>
/// </summary>
public interface IStatsReader<TStats, TFilter>
{
    Task<TStats?> FindAsync(Guid id, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<TStats>> QueryAsync(TFilter filter, CancellationToken cancellationToken = default);
}
