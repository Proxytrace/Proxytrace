using Trsr.Domain.TestResult;

namespace Trsr.Api.Dto.TestRuns;

public record TestRunDto(
    Guid Id,
    Guid AgentId,
    DateTimeOffset Timestamp,
    IReadOnlyList<TestResultDto> Results,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public record TestResultDto(
    Guid Id,
    Guid TestCaseId,
    TestRunMessageDto ActualResponse,
    Evaluation Evaluation);

public record TestRunMessageDto(string Role, string Content);

public record CreateTestRunRequest(Guid TestSuiteId);
