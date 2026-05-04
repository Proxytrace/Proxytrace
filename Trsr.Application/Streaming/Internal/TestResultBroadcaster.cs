using System.Collections.Concurrent;
using System.Threading.Channels;

namespace Trsr.Application.Streaming.Internal;

internal class TestResultBroadcaster : ITestResultBroadcaster, IDisposable
{
    private readonly ConcurrentDictionary<Guid, (Guid RunId, ChannelWriter<TestRunEvent> Writer)>
        runSubscribers = new();

    private readonly ConcurrentDictionary<Guid, (Guid GroupId, ChannelWriter<TestRunEvent> Writer)>
        groupSubscribers = new();

    public ChannelReader<TestRunEvent> Subscribe(Guid runId, CancellationToken cancellationToken)
    {
        var channel = CreateChannel();
        var id = Guid.NewGuid();
        runSubscribers[id] = (runId, channel.Writer);
        cancellationToken.Register(() =>
        {
            runSubscribers.TryRemove(id, out _);
            channel.Writer.TryComplete();
        });
        return channel.Reader;
    }

    public ChannelReader<TestRunEvent> SubscribeToGroup(Guid groupId, CancellationToken cancellationToken)
    {
        var channel = CreateChannel();
        var id = Guid.NewGuid();
        groupSubscribers[id] = (groupId, channel.Writer);
        cancellationToken.Register(() =>
        {
            groupSubscribers.TryRemove(id, out _);
            channel.Writer.TryComplete();
        });
        return channel.Reader;
    }

    public void Publish(TestRunEvent evt)
    {
        ForwardToRunSubscribers(evt);
        ForwardToGroupSubscribers(evt);
    }

    public void PublishComplete(RunCompleteEvent evt)
    {
        foreach (var kvp in runSubscribers)
        {
            var (runId, writer) = kvp.Value;
            if (runId != evt.RunId)
                continue;
            writer.TryWrite(evt);
            writer.TryComplete();
            runSubscribers.TryRemove(kvp.Key, out _);
        }

        // Forward run-complete to group channel but do NOT close it yet —
        // the group stays open until PublishGroupComplete is called.
        ForwardToGroupSubscribers(evt);
    }

    public void PublishGroupComplete(GroupRunCompleteEvent evt)
    {
        foreach (var kvp in groupSubscribers)
        {
            var (groupId, writer) = kvp.Value;
            if (groupId != evt.GroupId)
                continue;
            writer.TryWrite(evt);
            writer.TryComplete();
            groupSubscribers.TryRemove(kvp.Key, out _);
        }
    }

    public void Dispose()
    {
        foreach (var (_, writer) in runSubscribers.Values)
            writer.TryComplete();
        runSubscribers.Clear();

        foreach (var (_, writer) in groupSubscribers.Values)
            writer.TryComplete();
        groupSubscribers.Clear();
    }

    private void ForwardToRunSubscribers(TestRunEvent evt)
    {
        foreach (var kvp in runSubscribers)
        {
            var (runId, writer) = kvp.Value;
            if (runId != evt.RunId)
                continue;
            if (!writer.TryWrite(evt))
                runSubscribers.TryRemove(kvp.Key, out _);
        }
    }

    private void ForwardToGroupSubscribers(TestRunEvent evt)
    {
        if (evt.GroupId == Guid.Empty)
            return;

        foreach (var kvp in groupSubscribers)
        {
            var (groupId, writer) = kvp.Value;
            if (groupId != evt.GroupId)
                continue;
            if (!writer.TryWrite(evt))
                groupSubscribers.TryRemove(kvp.Key, out _);
        }
    }

    private static Channel<TestRunEvent> CreateChannel()
        => Channel.CreateBounded<TestRunEvent>(new BoundedChannelOptions(100)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
            SingleWriter = false,
        });
}
