using Trsr.Domain.Events;

namespace Trsr.Application.Statistics.Internal;

internal interface IStatsProjector
{
    Type EntityType { get; }

    Task ProjectAsync(Guid entityId, EntityChangeType change, CancellationToken cancellationToken);
}
