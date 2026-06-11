using Proxytrace.Api.Dto.TestRuns;
using Proxytrace.Domain.Evaluation;

namespace Proxytrace.Api.Dto.Evaluators;

public record EvaluatorTestBenchPayloadDto(
    Guid SourceTestResultId,
    Guid TestCaseId,
    string TestCaseSummary,
    IReadOnlyList<TestRunMessageDto> Conversation,
    string ExpectedResponse,
    string ActualResponse,
    /// <summary>This evaluator's logged verdict on the source test result, when one exists — seeds the bench's baseline.</summary>
    EvaluationResultDto? LoggedEvaluation);

public record RunEvaluatorOnBenchRequest(
    Guid TestCaseId,
    string? ActualResponseOverride);

public record EvaluatorTestBenchDefaultDto(
    Guid? TestCaseId,
    string? Label);

public record EvaluatorTestBenchRecentItemDto(
    Guid TestCaseId,
    string Label,
    /// <summary>This evaluator's logged score on the recent result, when one exists.</summary>
    EvaluationScore? Score);

public record RecentEvaluationItemDto(
    Guid TestResultId,
    Guid TestCaseId,
    string CaseSummary,
    string? Score,
    bool Passed,
    string? Reasoning,
    int LatencyMs,
    DateTimeOffset EvaluatedAt,
    Guid? RunId);
