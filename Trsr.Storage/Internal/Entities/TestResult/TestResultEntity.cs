using Trsr.Domain.Evaluation;
using Trsr.Domain.Message;
using Trsr.Domain.TestResult;

namespace Trsr.Storage.Internal.Entities.TestResult;

[StoredDomainEntity(typeof(ITestResult))]
internal record TestResultEntity : Entity
{
    public required Guid TestCase { get; init; }
    public required AssistantMessage ActualResponse { get; init; }
    public required IReadOnlyCollection<StoredEvaluation> Evaluations { get; init; }
    public required long DurationMs { get; init; }
    public required long? InputTokens { get; init; }
    public required long? OutputTokens { get; init; }
}

/// <summary>
/// Storage-only value object for serializing an evaluation into the TestResult row.
/// </summary>
internal record StoredEvaluation
{
    public required Guid EvaluatorId { get; init; }
    public required EvaluationScore Score { get; init; }
    public string? Reasoning { get; init; }
}
