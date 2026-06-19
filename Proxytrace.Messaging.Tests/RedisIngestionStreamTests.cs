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
}
