using Proxytrace.Domain.Evaluation;
using Proxytrace.Domain.Evaluator;
using Proxytrace.Domain.TestRun;

namespace Proxytrace.Api.Dto.TestRuns;

public record RunEvaluatorDto(Guid Id, EvaluatorKind Kind, string Name);

public record EvaluationResultDto(
    Guid EvaluatorId,
    EvaluatorKind EvaluatorKind,
    string EvaluatorName,
    EvaluationScore? Score,
    string? Reasoning,
    string? ErrorMessage);

public record TestRunDto(
    Guid Id,
    Guid GroupId,
    Guid SuiteId,
    string SuiteName,
    Guid AgentId,
    string AgentName,
    Guid EndpointId,
    string EndpointName,
    TestRunStatus Status,
    int TotalCases,
    int PassedCases,
    int FailedCases,
    double PassRate,
    double? CostUsd,
    long? TokensIn,
    long? TokensOut,
    long? CachedTokensIn,
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

public record TestRunGroupDto(
    Guid Id,
    Guid SuiteId,
    string SuiteName,
    Guid AgentId,
    string AgentName,
    TestRunStatus Status,
    bool IsSystemRun,
    DateTimeOffset? CompletedAt,
    IReadOnlyList<TestRunDto> Runs,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

/// <summary>
/// Lightweight per-run projection for the run-group list cards — just the fields the left-rail
/// ModelStack renders (endpoint + pass/fail counts). Omits the fat <see cref="TestRunDto"/>'s
/// per-case results, test cases, and evaluations.
/// </summary>
public record TestRunSummaryDto(
    Guid Id,
    Guid EndpointId,
    string EndpointName,
    TestRunStatus Status,
    int TotalCases,
    int PassedCases,
    int FailedCases,
    double PassRate);

/// <summary>
/// Lightweight run-group projection for the runs list. Carries only what the left-rail card needs;
/// the full <see cref="TestRunGroupDto"/> (with nested per-case results) is fetched per-selection
/// via <c>GET /api/test-run-groups/{id}</c>.
/// </summary>
public record TestRunGroupListItemDto(
    Guid Id,
    Guid SuiteId,
    string SuiteName,
    Guid AgentId,
    string AgentName,
    TestRunStatus Status,
    bool IsSystemRun,
    DateTimeOffset? CompletedAt,
    IReadOnlyList<TestRunSummaryDto> Runs,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public record CreateTestRunGroupRequest(
    Guid TestSuiteId,
    IReadOnlyList<Guid> ModelEndpointIds);
