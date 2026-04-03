using Trsr.Domain.Evaluator;

namespace Trsr.Api.Dto.TestSuites;

public record TestSuiteDto(
    Guid Id,
    Guid AgentId,
    EvaluatorKind EvaluatorKind,
    IReadOnlyList<TestCaseDto> TestCases,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public record TestCaseDto(
    Guid Id,
    IReadOnlyList<MessageDto> Input,
    MessageDto ExpectedOutput);

public record MessageDto(string Role, string Content);

public record CreateTestSuiteRequest(
    Guid AgentId,
    EvaluatorKind EvaluatorKind,
    IReadOnlyList<CreateTestCaseRequest> TestCases);

public record CreateTestCaseRequest(
    Guid? FromAgentCallId,
    IReadOnlyList<MessageDto>? Input,
    MessageDto? ExpectedOutput);

public record AddTestCaseRequest(
    Guid? FromAgentCallId,
    IReadOnlyList<MessageDto>? Input,
    MessageDto? ExpectedOutput);

/// <summary>
/// Request to create a test suite by promoting one or more traced agent calls.
/// Callers select which traces to include, enabling curation over blind bulk import.
/// </summary>
public record PromoteTracesRequest(
    /// <summary>The agent whose traces are being promoted. Must match the agent that produced the traces.</summary>
    Guid AgentId,
    /// <summary>IDs of the <c>AgentCall</c> traces to promote into test cases.</summary>
    IReadOnlyList<Guid> AgentCallIds);
