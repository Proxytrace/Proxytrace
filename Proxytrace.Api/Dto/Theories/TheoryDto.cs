using Proxytrace.Api.Dto.Proposals;
using Proxytrace.Domain.OptimizationProposal;
using Proxytrace.Domain.OptimizationTheory;
using Proxytrace.Domain.Proposal;

namespace Proxytrace.Api.Dto.Theories;

/// <summary>
/// An unproven optimization theory and its validation lifecycle state.
/// </summary>
public record TheoryDto(
    Guid Id,
    ProposalKind Kind,
    TheoryStatus Status,
    TheorySource Source,
    Guid AgentId,
    string AgentName,
    Guid SuiteId,
    Priority Priority,
    string Rationale,
    ProposalDetailsDto Details,
    Guid[] EvidenceTestRunIds,
    Guid? ResultingProposalId,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

/// <summary>
/// Request body for submitting a new optimization theory. <see cref="Details"/> is polymorphic:
/// use <c>SystemPrompt</c>, <c>ModelSwitchSeed</c>, or <c>ToolUpdateSeed</c> discriminators.
/// </summary>
public record SubmitTheoryRequest(
    Guid AgentId,
    Guid SuiteId,
    Priority Priority,
    string Rationale,
    TheorySource Source,
    ProposalDetailsDto Details);
