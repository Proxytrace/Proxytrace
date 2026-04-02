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
