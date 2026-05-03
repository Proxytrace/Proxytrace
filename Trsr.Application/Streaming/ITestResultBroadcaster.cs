using System.Threading.Channels;
using Trsr.Domain.Evaluation;
using Trsr.Domain.Evaluator;
using Trsr.Domain.TestResult;
using Trsr.Domain.TestRun;

namespace Trsr.Application.Streaming;

public record EvaluationEventData(
    Guid EvaluatorId,
    EvaluatorKind EvaluatorKind,
    string EvaluatorName,
    EvaluationScore Score,
    string? Reasoning);

public abstract record TestRunEvent(Guid RunId);

public record TestResultArrivedEvent(
    Guid RunId,
    Guid TestCaseId,
    EvaluationScore? OverallScore,
    IReadOnlyList<EvaluationEventData> Evaluations,
    long DurationMs) : TestRunEvent(RunId)
{
    public static TestResultArrivedEvent Create(ITestRun run, ITestResult result)
        => new(
            run.Id,
            result.TestCase.Id,
            result.OverallScore,
            result.Evaluations.Select(e => new EvaluationEventData(
                e.Evaluator.Id,
                e.Evaluator.Kind,
                GetEvaluatorName(e.Evaluator),
                e.Score,
                e.Reasoning)).ToArray(),
            (long)result.Duration.TotalMilliseconds);

    private static string GetEvaluatorName(IEvaluator evaluator) => evaluator switch
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
