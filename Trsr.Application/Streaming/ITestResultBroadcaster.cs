using System.Threading.Channels;
using Trsr.Domain.Evaluation;
using Trsr.Domain.Evaluator;
using Trsr.Domain.TestResult;
using Trsr.Domain.TestRun;
using Trsr.Domain.TestRunGroup;

namespace Trsr.Application.Streaming;

public record EvaluationEventData(
    Guid EvaluatorId,
    EvaluatorKind EvaluatorKind,
    string EvaluatorName,
    EvaluationScore Score,
    string? Reasoning);

public abstract record TestRunEvent(Guid RunId, Guid GroupId);

public record TestCaseStartedEvent(
    Guid RunId,
    Guid GroupId,
    Guid TestCaseId) : TestRunEvent(RunId, GroupId);

public record InferenceDoneEvent(
    Guid RunId,
    Guid GroupId,
    Guid TestCaseId) : TestRunEvent(RunId, GroupId);

public record EvaluationArrivedEvent(
    Guid RunId,
    Guid GroupId,
    Guid TestCaseId,
    EvaluationEventData Evaluation) : TestRunEvent(RunId, GroupId);

public record TestResultArrivedEvent(
    Guid RunId,
    Guid GroupId,
    Guid TestCaseId,
    EvaluationScore? OverallScore,
    IReadOnlyList<EvaluationEventData> Evaluations,
    long DurationMs) : TestRunEvent(RunId, GroupId)
{
    public static TestResultArrivedEvent Create(ITestRun run, ITestResult result)
        => new(
            run.Id,
            run.Group.Id,
            result.TestCase.Id,
            result.OverallScore,
            result.Evaluations.Select(e => new EvaluationEventData(
                e.Evaluator.Id,
                e.Evaluator.Kind,
                GetEvaluatorName(e.Evaluator),
                e.Score,
                e.Reasoning)).ToArray(),
            (long)result.Statistics.Duration.TotalMilliseconds);

    internal static string GetEvaluatorName(IEvaluator evaluator) => evaluator switch
    {
        ICustomEvaluator custom => custom.Name,
        _ => evaluator.Kind switch
        {
            EvaluatorKind.ExactMatch => "Exact Match",
            EvaluatorKind.NumericMatch => "Numeric Match",
            EvaluatorKind.Helpfulness => "Helpfulness",
            EvaluatorKind.Politeness => "Politeness",
            EvaluatorKind.JsonSchemaMatch => "JSON Schema Match",
            EvaluatorKind.Safety => "Safety Classifier",
            EvaluatorKind.ToolUsage => "Tool Usage",
            _ => evaluator.Kind.ToString()
        }
    };
}

public record RunCompleteEvent(
    Guid RunId,
    Guid GroupId,
    TestRunStatus Status,
    DateTimeOffset? CompletedAt) : TestRunEvent(RunId, GroupId)
{
    public static RunCompleteEvent Create(ITestRun testRun)
        => new(testRun.Id, testRun.Group.Id, testRun.Status, testRun.CompletedAt);
}

/// <summary>
/// Terminal event published to group-level subscribers when every run in the group has finished.
/// <see cref="TestRunEvent.RunId"/> is <see cref="Guid.Empty"/> for this event type.
/// </summary>
public record GroupRunCompleteEvent(
    Guid GroupId,
    TestRunStatus GroupStatus,
    DateTimeOffset? GroupCompletedAt) : TestRunEvent(Guid.Empty, GroupId)
{
    public static GroupRunCompleteEvent Create(ITestRunGroup group)
        => new(group.Id, group.Status, group.CompletedAt);
}

public interface ITestResultBroadcaster
{
    /// <summary>Subscribe to real-time events for a single run.</summary>
    ChannelReader<TestRunEvent> Subscribe(Guid runId, CancellationToken cancellationToken);

    /// <summary>
    /// Subscribe to real-time events for all runs in a group, plus the final
    /// <see cref="GroupRunCompleteEvent"/> when every run has finished.
    /// </summary>
    ChannelReader<TestRunEvent> SubscribeToGroup(Guid groupId, CancellationToken cancellationToken);

    void Publish(TestRunEvent evt);
    void PublishComplete(RunCompleteEvent evt);
    void PublishGroupComplete(GroupRunCompleteEvent evt);
}
