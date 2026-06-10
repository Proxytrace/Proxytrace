using System.ComponentModel.DataAnnotations;
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

/// <summary>
/// Lightweight suite projection for the suites grid. Keeps the small evaluator refs (id + kind, for
/// the card badges) and run aggregates, but replaces the fat <see cref="TestCaseDto"/> list (full
/// input conversations + expected outputs) with just a count. The full suite is fetched per-selection
/// via <c>GET /api/test-suites/{id}</c>.
/// </summary>
public record TestSuiteListItemDto(
    Guid Id,
    string Name,
    Guid AgentId,
    string AgentName,
    IReadOnlyList<EvaluatorDto> Evaluators,
    int TestCaseCount,
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

public record TestSuiteMessageDto(
    string Role,
    string Content,
    IReadOnlyList<ToolRequestInputDto>? ToolRequests = null,
    string? ToolCallId = null);

public record ToolRequestInputDto(string Name, string Arguments, string? Id = null);

public record UpdateTestCaseRequest(TestSuiteMessageDto ExpectedOutput);

public record CreateTestSuiteRequest(
    [Required, StringLength(200, MinimumLength = 1)] string Name,
    [Required] Guid AgentId,
    [Required] IReadOnlyList<CreateTestCaseRequest> TestCases,
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
    [Required, StringLength(200, MinimumLength = 1)] string Name,
    [Required] Guid AgentId,
    [Required, MinLength(1)] IReadOnlyList<Guid> AgentCallIds,
    IReadOnlyList<Guid>? EvaluatorIds = null);
