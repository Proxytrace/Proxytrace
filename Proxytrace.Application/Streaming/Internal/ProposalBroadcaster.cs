using System.Collections.Concurrent;
using System.Threading.Channels;

namespace Proxytrace.Application.Streaming.Internal;

internal class ProposalBroadcaster : IProposalBroadcaster, IDisposable
{
    private readonly ConcurrentDictionary<Guid, ConcurrentDictionary<Guid, ChannelWriter<ProposalCreatedEvent>>> agentSubscribers = new();

    public ChannelReader<ProposalCreatedEvent> Subscribe(Guid agentId, CancellationToken cancellationToken)
    {
        var channel = Channel.CreateBounded<ProposalCreatedEvent>(new BoundedChannelOptions(100)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
            SingleWriter = false,
        });

        var subscriptionId = Guid.NewGuid();
        var subscribers = agentSubscribers.GetOrAdd(agentId, _ => new ConcurrentDictionary<Guid, ChannelWriter<ProposalCreatedEvent>>());
        subscribers[subscriptionId] = channel.Writer;

        cancellationToken.Register(() =>
        {
            if (agentSubscribers.TryGetValue(agentId, out var subs))
                subs.TryRemove(subscriptionId, out _);
            channel.Writer.TryComplete();
        });

        return channel.Reader;
    }

    public void Publish(ProposalCreatedEvent evt)
    {
        if (!agentSubscribers.TryGetValue(evt.AgentId, out var subscribers))
            return;

        foreach (var kvp in subscribers)
        {
            if (!kvp.Value.TryWrite(evt))
                subscribers.TryRemove(kvp.Key, out _);
        }
    }

    public void Dispose()
    {
        foreach (var (_, subscribers) in agentSubscribers)
        {
            foreach (var writer in subscribers.Values)
                writer.TryComplete();
        }
        agentSubscribers.Clear();
    }
}
