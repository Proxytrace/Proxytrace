namespace Proxytrace.Application.Statistics;

public interface IStatsWriter<TStats>
{
    Task UpsertAsync(TStats stats, CancellationToken cancellationToken = default);

    Task RemoveAsync(Guid id, CancellationToken cancellationToken = default);
}
