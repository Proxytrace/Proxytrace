using JetBrains.Annotations;
using Trsr.Domain.Message;
using Trsr.Domain.OptimizationProposal;
using Trsr.Domain.Tools;

namespace Trsr.Application.Demo.Internal;

[UsedImplicitly]
internal sealed record AgentScenarioFile(
    AgentSeedData Agent,
    IReadOnlyList<AgentCallSeedData> Calls,
    IReadOnlyList<TestCaseSeedData> TestCases,
    TestSuiteSeedData TestSuite,
    IReadOnlyList<OptimizationProposalSeedData> OptimizationProposals
);

[UsedImplicitly]
internal sealed record AgentSeedData(
    Guid Id,
    Guid EndpointId,
    string Name,
    SystemMessage SystemMessage,
    IReadOnlyList<ToolSpecification> Tools,
    DateTimeOffset CreatedAt
);

[UsedImplicitly]
internal sealed record AgentCallSeedData(
    Guid Id,
    Conversation Request,
    AssistantMessage Response,
    ulong InputTokens,
    ulong OutputTokens,
    int DurationMs,
    int HttpStatus,
    string? FinishReason,
    string? ErrorMessage,
    DateTimeOffset CreatedAt
);

[UsedImplicitly]
internal sealed record TestCaseSeedData(
    Guid Id,
    Conversation Input,
    AssistantMessage ExpectedOutput,
    DateTimeOffset CreatedAt
);

[UsedImplicitly]
internal sealed record TestSuiteSeedData(Guid Id, string Name, DateTimeOffset CreatedAt);

[UsedImplicitly]
internal sealed record OptimizationProposalSeedData(
    Guid Id,
    ProposalKind Kind,
    ProposalStatus Status,
    string Rationale,
    SystemMessage? ProposedSystemMessage,
    IReadOnlyList<ToolSpecification> ProposedTools,
    IReadOnlyList<Guid> EvidenceTestRunIds,
    DateTimeOffset CreatedAt
);
