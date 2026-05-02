using System.Threading.Channels;
using Trsr.Domain.TestResult;
using Trsr.Domain.TestRun;

namespace Trsr.Application.Streaming;

public abstract record TestRunEvent(Guid RunId);

public record TestResultArrivedEvent(
    Guid RunId,
    Guid TestCaseId,
    Evaluation Evaluation,
    long DurationMs) : TestRunEvent(RunId)
{
    public static TestResultArrivedEvent Create(ITestRun run, ITestResult result)
        => new(
            run.Id,
            result.TestCase.Id,
            result.Evaluations,
            (long)result.Duration.TotalMilliseconds);
}

public record RunCompleteEvent(
    Guid RunId,
    TestRunStatus Status,
    DateTimeOffset? CompletedAt) : TestRunEvent(RunId)
{
    public static RunCompleteEvent Create(ITestRun testRun)
        => new(
            testRun.Id,
            testRun.Status,
            testRun.CompletedAt);
}

public interface ITestResultBroadcaster
{
    ChannelReader<TestRunEvent> Subscribe(Guid runId, CancellationToken cancellationToken);
    
    void Publish(TestResultArrivedEvent evt);
    void PublishComplete(RunCompleteEvent evt);
}