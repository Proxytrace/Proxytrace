using Trsr.Api.Dto.TestRuns;

namespace Trsr.Api.Dto.Evaluators;

public record EvaluatorTestBenchPayloadDto(
    Guid SourceTestResultId,
    Guid TestCaseId,
    string TestCaseSummary,
    IReadOnlyList<TestRunMessageDto> Conversation,
    string ExpectedResponse,
    string ActualResponse);

public record RunEvaluatorOnBenchRequest(
    Guid TestCaseId,
    string? ActualResponseOverride);

public record EvaluatorTestBenchDefaultDto(
    Guid? TestCaseId,
    string? Label);

public record EvaluatorTestBenchRecentItemDto(
    Guid TestCaseId,
    string Label);

public record RecentEvaluationItemDto(
    Guid TestResultId,
    Guid TestCaseId,
    string CaseSummary,
    string? Score,
    bool Passed,
    string? Reasoning,
    int LatencyMs,
    DateTimeOffset EvaluatedAt);
