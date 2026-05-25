using AwesomeAssertions;
using Proxytrace.Application.Streaming;
using Proxytrace.Application.Streaming.Internal;
using Proxytrace.Domain.TestRun;

namespace Proxytrace.Application.Tests.Streaming;

[TestClass]
public sealed class TestResultBroadcasterTests
{
    [TestMethod]
    public async Task Subscribe_RunChannel_ReceivesOnlyMatchingRunEvents()
    {
        using var broadcaster = new TestResultBroadcaster();
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        var runId = Guid.NewGuid();
        var otherRunId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var reader = broadcaster.Subscribe(runId, cts.Token);

        broadcaster.Publish(new TestCaseStartedEvent(otherRunId, groupId, Guid.NewGuid()));
        var match = new InferenceDoneEvent(runId, groupId, Guid.NewGuid());
        broadcaster.Publish(match);

        var got = await reader.ReadAsync(cts.Token);
        got.Should().Be(match);
    }

    [TestMethod]
    public async Task GroupSubscriber_ReceivesEventsForGroup_AndIgnoresOthers()
    {
        using var broadcaster = new TestResultBroadcaster();
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        var groupId = Guid.NewGuid();
        var otherGroup = Guid.NewGuid();
        var reader = broadcaster.SubscribeToGroup(groupId, cts.Token);

        broadcaster.Publish(new TestCaseStartedEvent(Guid.NewGuid(), otherGroup, Guid.NewGuid()));
        var match = new TestCaseStartedEvent(Guid.NewGuid(), groupId, Guid.NewGuid());
        broadcaster.Publish(match);

        var got = await reader.ReadAsync(cts.Token);
        got.Should().Be(match);
    }

    [TestMethod]
    public async Task PublishComplete_DeliversToRunSubscriberAndCompletes()
    {
        using var broadcaster = new TestResultBroadcaster();
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        var runId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var reader = broadcaster.Subscribe(runId, cts.Token);

        var evt = new RunCompleteEvent(runId, groupId, TestRunStatus.Completed, DateTimeOffset.UtcNow);
        broadcaster.PublishComplete(evt);

        var got = await reader.ReadAsync(cts.Token);
        got.Should().Be(evt);
        await Task.WhenAny(reader.Completion, Task.Delay(2000, cts.Token));
        reader.Completion.IsCompleted.Should().BeTrue();
    }

    [TestMethod]
    public async Task PublishComplete_AlsoForwardedToGroupChannel_WithoutCompletingIt()
    {
        using var broadcaster = new TestResultBroadcaster();
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        var groupId = Guid.NewGuid();
        var runId = Guid.NewGuid();
        var groupReader = broadcaster.SubscribeToGroup(groupId, cts.Token);

        broadcaster.PublishComplete(new RunCompleteEvent(runId, groupId, TestRunStatus.Completed, DateTimeOffset.UtcNow));

        var got = await groupReader.ReadAsync(cts.Token);
        got.Should().BeOfType<RunCompleteEvent>();
        groupReader.Completion.IsCompleted.Should().BeFalse();
    }

    [TestMethod]
    public async Task PublishGroupComplete_CompletesGroupChannel()
    {
        using var broadcaster = new TestResultBroadcaster();
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        var groupId = Guid.NewGuid();
        var groupReader = broadcaster.SubscribeToGroup(groupId, cts.Token);

        var evt = new GroupRunCompleteEvent(groupId, TestRunStatus.Completed, DateTimeOffset.UtcNow);
        broadcaster.PublishGroupComplete(evt);

        (await groupReader.ReadAsync(cts.Token)).Should().Be(evt);
        await Task.WhenAny(groupReader.Completion, Task.Delay(2000, cts.Token));
        groupReader.Completion.IsCompleted.Should().BeTrue();
    }

    [TestMethod]
    public async Task Cancellation_CompletesRunReader()
    {
        using var broadcaster = new TestResultBroadcaster();
        using var cts = new CancellationTokenSource();
        var reader = broadcaster.Subscribe(Guid.NewGuid(), cts.Token);

        await cts.CancelAsync();

        await Task.WhenAny(reader.Completion, Task.Delay(2000, cts.Token));
        reader.Completion.IsCompleted.Should().BeTrue();
    }

    [TestMethod]
    public void Publish_NoMatchingSubscribers_DoesNotThrow()
    {
        using var broadcaster = new TestResultBroadcaster();

        // ReSharper disable once AccessToDisposedClosure
        var act = () => broadcaster.Publish(new TestCaseStartedEvent(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid()));

        act.Should().NotThrow();
    }
}
