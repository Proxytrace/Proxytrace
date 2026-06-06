namespace Proxytrace.Api.Dto.TestSuites;

public record UpdateTestSuiteRequest(
    Guid? AgentId,
    IReadOnlyList<Guid>? EvaluatorIds,
    IReadOnlyList<Guid>? TestCaseIds);
