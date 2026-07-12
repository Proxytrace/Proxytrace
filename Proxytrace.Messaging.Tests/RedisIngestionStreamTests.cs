using System.Text.Json;
using AwesomeAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Proxytrace.Messaging.Internal;
using StackExchange.Redis;

namespace Proxytrace.Messaging.Tests;

[TestClass]
public sealed class RedisIngestionStreamTests
{
    // Regression: with AbortOnConnectFail=false the multiplexer never throws on connect, so when
    // Redis is down a command blocks until ConnectTimeout (~5s) before failing. The queue-depth
    // read is observability-only and runs on the hot dashboard path, so it must bail out the moment
    // the multiplexer reports no connection rather than eating the timeout on every dashboard load.
    [TestMethod]
    public async Task GetQueueDepthAsync_WhenDisconnected_ReturnsZeroWithoutIssuingCommand()
    {
        var database = Substitute.For<IDatabase>();
        database.StreamGroupInfoAsync(Arg.Any<RedisKey>(), Arg.Any<CommandFlags>())
            .Returns(Array.Empty<StreamGroupInfo>());

        var connection = Substitute.For<IConnectionMultiplexer>();
        connection.IsConnected.Returns(false);
        connection.GetDatabase(Arg.Any<int>(), Arg.Any<object>()).Returns(database);

        var stream = new RedisIngestionStream(
            connection,
            new MessagingConfiguration(),
            NullLogger<RedisIngestionStream>.Instance);

        long depth = await stream.GetQueueDepthAsync(CancellationToken.None);

        depth.Should().Be(0L);
        connection.DidNotReceiveWithAnyArgs().GetDatabase();
    }

    [TestMethod]
    public void RedeliversUnacknowledged_IsTrue()
    {
        // Pending entries are reclaimed via XAUTOCLAIM and redelivered, so the consumer may leave a
        // retryable failure unacked rather than retrying it inline.
        var stream = new RedisIngestionStream(
            Substitute.For<IConnectionMultiplexer>(),
            new MessagingConfiguration(),
            NullLogger<RedisIngestionStream>.Instance);

        stream.RedeliversUnacknowledged.Should().BeTrue();
    }

    // Regression: poison entries (those that fail to deserialize) used to be acked with the blocking
    // synchronous StreamAcknowledge from inside the consume iterator. With AbortOnConnectFail=false a
    // Redis blip makes that sync call block until ConnectTimeout, stalling the single producer one
    // entry at a time (and a throw tore down the whole Parallel.ForEachAsync round). The consumer must
    // now ack poison entries with the async StreamAcknowledgeAsync — never the sync overload — while
    // still yielding the valid entries in the same batch.
    [TestMethod]
    public async Task ConsumeAsync_WithPoisonEntry_AcksAsynchronouslyAndStillYieldsValidEntries()
    {
        var config = new MessagingConfiguration();
        var database = Substitute.For<IDatabase>();

        // No reclaimed entries — XAUTOCLAIM yields an empty result.
        database.StreamAutoClaimAsync(
                Arg.Any<RedisKey>(), Arg.Any<RedisValue>(), Arg.Any<RedisValue>(),
                Arg.Any<long>(), Arg.Any<RedisValue>(), Arg.Any<int?>(), Arg.Any<CommandFlags>())
            .Returns(StreamAutoClaimResult.Null);

        // A poison entry (empty payload → deserializes to null) ahead of a valid one in the batch.
        StreamEntry poison = MakeEntry("1-0", string.Empty);
        StreamEntry valid = MakeEntry("2-0", JsonSerializer.Serialize(SampleMessage()));
        var batches = new Queue<StreamEntry[]>();
        batches.Enqueue(new[] { poison, valid });
        database.StreamReadGroupAsync(
                Arg.Any<RedisKey>(), Arg.Any<RedisValue>(), Arg.Any<RedisValue>(),
                Arg.Any<RedisValue?>(), Arg.Any<int?>(), Arg.Any<bool>(), Arg.Any<CommandFlags>())
            .Returns(_ => batches.Count > 0 ? batches.Dequeue() : Array.Empty<StreamEntry>());

        var connection = Substitute.For<IConnectionMultiplexer>();
        connection.GetDatabase(Arg.Any<int>(), Arg.Any<object>()).Returns(database);

        var stream = new RedisIngestionStream(
            connection, config, NullLogger<RedisIngestionStream>.Instance);

        // The consume loop only ends when the token is cancelled, which the body below does after the
        // first envelope. Should the mocked XREADGROUP ever stop matching the call — a StackExchange.Redis
        // release appends an optional parameter as a new overload, and an under-specified call re-binds
        // to it — nothing is yielded, the cancel never runs and the loop spins forever. The deadline
        // turns that into a failed assertion in seconds instead of a test run that hangs until CI is
        // killed hours later.
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        var received = new List<IngestEnvelope>();
        try
        {
            await foreach (IngestEnvelope envelope in stream.ConsumeAsync(cts.Token))
            {
                received.Add(envelope);
                cts.Cancel(); // one valid entry is enough; stop the otherwise-infinite consume loop
            }
        }
        catch (OperationCanceledException)
        {
            // Deadline elapsed — fall through so the assertions below report what was actually missing.
        }

        received.Should().ContainSingle();
        received[0].MessageId.Should().Be("2-0");

        // The poison id is acked via the async batched overload...
        await database.Received(1).StreamAcknowledgeAsync(
            config.Stream,
            config.ConsumerGroup,
            Arg.Is<RedisValue[]>(ids => ids != null && ids.Length == 1 && ids[0] == "1-0"),
            Arg.Any<CommandFlags>());
        // ...and never via the blocking synchronous overload.
        database.DidNotReceiveWithAnyArgs().StreamAcknowledge(
            Arg.Any<RedisKey>(), Arg.Any<RedisValue>(), Arg.Any<RedisValue>(), Arg.Any<CommandFlags>());
    }

    private static StreamEntry MakeEntry(string id, string payload)
        => new(id, new[] { new NameValueEntry("payload", payload) });

    private static IngestMessage SampleMessage()
        => new(
            ProviderId: Guid.NewGuid(),
            ProjectId: Guid.NewGuid(),
            RequestBody: "{}",
            ResponseBody: "{}",
            DurationMs: 1,
            HttpStatus: 200,
            SessionId: null);
}
