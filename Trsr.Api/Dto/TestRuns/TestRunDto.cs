using Trsr.Domain.Evaluation;
using Trsr.Domain.Evaluator;
using Trsr.Domain.TestRun;

namespace Trsr.Api.Dto.TestRuns;

public record RunEvaluatorDto(Guid Id, EvaluatorKind Kind, string Name);

public record EvaluationResultDto(
    Guid EvaluatorId,
    EvaluatorKind EvaluatorKind,
    string EvaluatorName,
    EvaluationScore Score,
    string? Reasoning);

public record TestRunDto(
    Guid Id,
    Guid? SuiteId,
    string? SuiteName,
    Guid AgentId,
    string AgentName,
    TestRunStatus Status,
    int TotalCases,
    int PassedCases,
    int FailedCases,
    double PassRate,
    IReadOnlyList<RunEvaluatorDto> Evaluators,
    DateTimeOffset StartedAt,
    DateTimeOffset? CompletedAt,
    long? DurationMs,
    IReadOnlyList<TestCaseRowDto> TestCases,
    IReadOnlyList<TestResultDto> Results,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public record TestCaseRowDto(Guid Id, string Summary);

public record TestResultDto(
    Guid Id,
    Guid TestCaseId,
    string TestCaseSummary,
    string ActualResponse,
    IReadOnlyList<EvaluationResultDto> Evaluations,
    long DurationMs);

public record TestRunMessageDto(string Role, string Content);

public record CreateTestRunRequest(
    Guid TestSuiteId,
    Guid ModelEndpointId);
