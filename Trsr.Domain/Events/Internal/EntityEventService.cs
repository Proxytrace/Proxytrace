using System.Collections.Concurrent;
using System.Threading.Channels;

namespace Trsr.Domain.Events.Internal;

internal class EntityEventService : IEntityEventService, IDisposable
{
    private readonly ConcurrentDictionary<Guid, Subscription> subscribers = new();

    public void Notify(EntityChangedEvent evt)
    {
        foreach (var kvp in subscribers)
        {
            Subscription sub = kvp.Value;
            if (sub.EntityType is not null && sub.EntityType != evt.EntityType)
            {
                continue;
            }

            if (!sub.Writer.TryWrite(evt))
            {
                subscribers.TryRemove(kvp.Key, out _);
            }
        }
    }

    public ChannelReader<EntityChangedEvent> Subscribe(CancellationToken cancellationToken, Type? entityType = null)
    {
        if (!cancellationToken.CanBeCanceled)
        {
            throw new ArgumentException(
                "Subscription requires a cancellable token to avoid leaking subscribers.",
                nameof(cancellationToken));
        }

        Channel<EntityChangedEvent> channel = Channel.CreateUnbounded<EntityChangedEvent>(new UnboundedChannelOptions
        {
            SingleReader = true,
            SingleWriter = false,
        });

        Guid id = Guid.NewGuid();
        subscribers[id] = new Subscription(channel.Writer, entityType);

        cancellationToken.Register(() =>
        {
            subscribers.TryRemove(id, out _);
            channel.Writer.TryComplete();
        });

        return channel.Reader;
    }

    public void Dispose()
    {
        Subscription[] snapshot = subscribers.Values.ToArray();
        subscribers.Clear();
        foreach (Subscription sub in snapshot)
        {
            sub.Writer.TryComplete();
        }
    }

    private sealed record Subscription(ChannelWriter<EntityChangedEvent> Writer, Type? EntityType);
}
