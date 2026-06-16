using AwesomeAssertions;
using Proxytrace.Messaging.Internal;

namespace Proxytrace.Messaging.Tests;

[TestClass]
public sealed class InProcessIngestionStreamTests
{
    [TestMethod]
    public async Task PublishThenConsume_YieldsMessagesInOrder()
    {
        var stream = new InProcessIngestionStream();
        var first = Message("one");
        var second = Message("two");

        await stream.PublishAsync(first);
        await stream.PublishAsync(second);

        var received = new List<IngestEnvelope>();
        await foreach (IngestEnvelope envelope in stream.ConsumeAsync(CancellationToken.None))
        {
            received.Add(envelope);
            if (received.Count == 2)
            {
                break;
            }
        }

        received.Select(e => e.Message).Should().Equal(first, second);
        received.Should().OnlyContain(e => !string.IsNullOrEmpty(e.MessageId));
    }

    [TestMethod]
    public async Task Ack_IsNoOp()
    {
        var stream = new InProcessIngestionStream();

        Func<Task> ack = () => stream.AckAsync("any-id");

        await ack.Should().NotThrowAsync();
    }

    [TestMethod]
    public async Task GetQueueDepth_ReflectsUnconsumedMessages()
    {
        var stream = new InProcessIngestionStream();
        (await stream.GetQueueDepthAsync()).Should().Be(0);

        await stream.PublishAsync(Message("one"));
        await stream.PublishAsync(Message("two"));

        (await stream.GetQueueDepthAsync()).Should().Be(2);
    }

    private static IngestMessage Message(string marker) => new(
        ProviderId: Guid.NewGuid(),
        ProjectId: Guid.NewGuid(),
        RequestBody: marker,
        ResponseBody: null,
        DurationMs: 1,
        HttpStatus: 200,
        SessionId: null);
}
