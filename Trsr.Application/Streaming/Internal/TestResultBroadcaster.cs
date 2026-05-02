using System.Collections.Concurrent;
using System.Threading.Channels;

namespace Trsr.Application.Streaming.Internal;

internal class TestResultBroadcaster : ITestResultBroadcaster
{
    private readonly ConcurrentDictionary<Guid, (Guid RunId, ChannelWriter<TestRunEvent> Writer)> runSubscribers = new();

    public ChannelReader<TestRunEvent> Subscribe(Guid runId, CancellationToken cancellationToken)
    {
        var channel = Channel.CreateBounded<TestRunEvent>(new BoundedChannelOptions(100)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
            SingleWriter = false,
        });
        var id = Guid.NewGuid();
        runSubscribers[id] = (runId, channel.Writer);
        cancellationToken.Register(() =>
        {
            runSubscribers.TryRemove(id, out _);
            channel.Writer.TryComplete();
        });
        return channel.Reader;
    }

    public void Publish(TestResultArrivedEvent evt)
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
    }
}
