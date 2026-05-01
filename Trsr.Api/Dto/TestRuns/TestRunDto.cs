using Trsr.Domain.TestResult;
using Trsr.Domain.TestRun;

namespace Trsr.Api.Dto.TestRuns;

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
    DateTimeOffset StartedAt,
    DateTimeOffset? CompletedAt,
    long? DurationMs,
    IReadOnlyList<TestResultDto> Results,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public record TestResultDto(
    Guid Id,
    Guid TestCaseId,
    string TestCaseSummary,
    string ActualResponse,
    Evaluation Evaluation,
    long DurationMs);

public record TestRunMessageDto(string Role, string Content);

public record CreateTestRunRequest(
    Guid TestSuiteId,
    Guid ModelEndpointId);
