using System.Collections.Concurrent;
using System.Threading.Channels;

namespace Trsr.Application.Streaming.Internal;

internal class TraceBroadcaster : ITraceBroadcaster
{
    private readonly ConcurrentDictionary<Guid, ChannelWriter<TraceCreatedEvent>> traceSubscribers = new();

    public ChannelReader<TraceCreatedEvent> Subscribe(CancellationToken cancellationToken)
    {
        var channel = Channel.CreateBounded<TraceCreatedEvent>(new BoundedChannelOptions(100)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
            SingleWriter = false,
        });
        var id = Guid.NewGuid();
        traceSubscribers[id] = channel.Writer;
        cancellationToken.Register(() =>
        {
            traceSubscribers.TryRemove(id, out _);
            channel.Writer.TryComplete();
        });
        return channel.Reader;
    }

    public void Publish(TraceCreatedEvent evt)
    {
        foreach (var kvp in traceSubscribers)
        {
            if (!kvp.Value.TryWrite(evt))
                traceSubscribers.TryRemove(kvp.Key, out _);
        }
    }
}
