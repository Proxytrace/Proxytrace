namespace Proxytrace.Application.Statistics.Internal;

internal interface IStatsProjector
{
    Type EntityType { get; }

    Task ProjectAsync(Guid entityId, CancellationToken cancellationToken);
}
