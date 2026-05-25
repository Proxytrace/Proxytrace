using Proxytrace.Domain.Evaluator;

namespace Proxytrace.Api.Dto.TestSuites;

public record TestSuiteDto(
    Guid Id,
    string Name,
    Guid AgentId,
    string AgentName,
    IReadOnlyList<EvaluatorDto> Evaluators,
    IReadOnlyList<TestCaseDto> TestCases,
    string? Description,
    IReadOnlyList<string> Tags,
    int TotalRuns,
    double? PassRate,
    double? PrevPassRate,
    IReadOnlyList<double> PassRateTrend,
    DateTimeOffset? LastRunAt,
    Guid? LastRunGroupId,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public record EvaluatorDto(Guid Id, EvaluatorKind Kind);

public record TestCaseDto(
    Guid Id,
    IReadOnlyList<TestSuiteMessageDto> Input,
    TestSuiteMessageDto ExpectedOutput);

public record TestSuiteMessageDto(string Role, string Content);

public record CreateTestSuiteRequest(
    string Name,
    Guid AgentId,
    IReadOnlyList<CreateTestCaseRequest> TestCases,
    IReadOnlyList<Guid>? EvaluatorIds = null);

public record CreateTestCaseRequest(
    Guid? FromAgentCallId,
    IReadOnlyList<TestSuiteMessageDto>? Input,
    TestSuiteMessageDto? ExpectedOutput);

public record AddTestCaseRequest(
    Guid? FromAgentCallId,
    IReadOnlyList<TestSuiteMessageDto>? Input,
    TestSuiteMessageDto? ExpectedOutput);

/// <summary>
/// Request to create a test suite by promoting one or more traced agent calls.
/// Callers select which traces to include, enabling curation over blind bulk import.
/// </summary>
public record PromoteTracesRequest(
    string Name,
    Guid AgentId,
    IReadOnlyList<Guid> AgentCallIds,
    IReadOnlyList<Guid>? EvaluatorIds = null);
