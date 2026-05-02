using System.Threading.Channels;
using Trsr.Domain.TestResult;
using Trsr.Domain.TestRun;

namespace Trsr.Application.Streaming;

public record TraceCreatedEvent(
    Guid Id,
    Guid AgentId,
    string AgentName,
    string Model,
    string Provider,
    DateTimeOffset CreatedAt);

public abstract record TestRunEvent(Guid RunId);

public record TestResultArrivedEvent(
    Guid RunId,
    Guid TestCaseId,
    Evaluation Evaluation,
    long DurationMs) : TestRunEvent(RunId);

public record RunCompleteEvent(
    Guid RunId,
    TestRunStatus Status,
    DateTimeOffset? CompletedAt) : TestRunEvent(RunId);

public interface ITraceBroadcaster
{
    ChannelReader<TraceCreatedEvent> Subscribe(CancellationToken cancellationToken);
    void Publish(TraceCreatedEvent evt);
}

public interface ITestResultBroadcaster
{
    ChannelReader<TestRunEvent> Subscribe(Guid runId, CancellationToken cancellationToken);
    void Publish(TestResultArrivedEvent evt);
    void PublishComplete(RunCompleteEvent evt);
}
