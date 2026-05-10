namespace Trsr.Application.Statistics;

public interface IStatsWriter<TStats> where TStats : IStats
{
    Task UpsertAsync(TStats stats, CancellationToken cancellationToken = default);

    Task RemoveAsync(Guid id, CancellationToken cancellationToken = default);
}
