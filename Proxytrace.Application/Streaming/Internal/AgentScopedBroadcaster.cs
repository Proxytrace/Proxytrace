using System.Collections.Concurrent;
using System.Threading.Channels;

namespace Proxytrace.Application.Streaming.Internal;

/// <summary>
/// Shared fan-out plumbing for SSE broadcasters keyed by agent. Subscribers register per
/// agent id; <see cref="Publish"/> writes an event to every subscriber of its agent. Each
/// subscription gets a bounded channel that drops the oldest event when a slow reader falls
/// behind, and is cleaned up when its cancellation token fires.
/// </summary>
internal abstract class AgentScopedBroadcaster<TEvent> : IDisposable
{
    private readonly ConcurrentDictionary<Guid, ConcurrentDictionary<Guid, ChannelWriter<TEvent>>> subscribers = new();

    /// <summary>Extracts the agent id an event should be delivered to.</summary>
    protected abstract Guid KeyOf(TEvent evt);

    public ChannelReader<TEvent> Subscribe(Guid agentId, CancellationToken cancellationToken)
    {
        var channel = Channel.CreateBounded<TEvent>(new BoundedChannelOptions(100)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
            SingleWriter = false,
        });

        var subscriptionId = Guid.NewGuid();
        var agentSubscribers = subscribers.GetOrAdd(agentId, _ => new ConcurrentDictionary<Guid, ChannelWriter<TEvent>>());
        agentSubscribers[subscriptionId] = channel.Writer;

        cancellationToken.Register(() =>
        {
            if (subscribers.TryGetValue(agentId, out var subs))
                subs.TryRemove(subscriptionId, out _);
            channel.Writer.TryComplete();
        });

        return channel.Reader;
    }

    public void Publish(TEvent evt)
    {
        if (!subscribers.TryGetValue(KeyOf(evt), out var agentSubscribers))
            return;

        foreach (var kvp in agentSubscribers)
        {
            if (!kvp.Value.TryWrite(evt))
                agentSubscribers.TryRemove(kvp.Key, out _);
        }
    }

    public void Dispose()
    {
        foreach (var (_, agentSubscribers) in subscribers)
        {
            foreach (var writer in agentSubscribers.Values)
                writer.TryComplete();
        }
        subscribers.Clear();
    }
}
