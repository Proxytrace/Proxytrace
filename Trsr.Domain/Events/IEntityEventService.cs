using System.Threading.Channels;

namespace Trsr.Domain.Events;

public enum EntityChangeType
{
    Added,
    Updated,
    Removed
}

public record EntityChangedEvent(Guid EntityId, Type EntityType, EntityChangeType ChangeType);

public interface IEntityEventService
{
    void Notify(EntityChangedEvent evt);

    ChannelReader<EntityChangedEvent> Subscribe(CancellationToken cancellationToken, Type? entityType = null);
}
