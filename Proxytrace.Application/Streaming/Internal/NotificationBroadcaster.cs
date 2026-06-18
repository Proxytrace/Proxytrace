using System.Collections.Concurrent;
using System.Threading.Channels;

namespace Proxytrace.Application.Streaming.Internal;

internal class NotificationBroadcaster : INotificationBroadcaster, IDisposable
{
    private readonly ConcurrentDictionary<Guid, ChannelWriter<NotificationEvent>> subscribers = new();

    public ChannelReader<NotificationEvent> Subscribe(CancellationToken cancellationToken)
    {
        var channel = Channel.CreateBounded<NotificationEvent>(new BoundedChannelOptions(100)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
            SingleWriter = false,
        });
        var id = Guid.NewGuid();
        subscribers[id] = channel.Writer;
        cancellationToken.Register(() =>
        {
            subscribers.TryRemove(id, out _);
            channel.Writer.TryComplete();
        });
        return channel.Reader;
    }

    public void Publish(NotificationEvent evt)
    {
        foreach (var kvp in subscribers)
        {
            if (!kvp.Value.TryWrite(evt))
                subscribers.TryRemove(kvp.Key, out _);
        }
    }

    public void Dispose()
    {
        var writers = subscribers.Values.ToList();
        subscribers.Clear();
        foreach (var writer in writers)
        {
            writer.TryComplete();
        }
    }
}
