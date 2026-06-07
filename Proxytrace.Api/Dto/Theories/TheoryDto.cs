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
    double? BaselinePassRate,
    double? ProjectedPassRate,
    double? PValue,
    Guid? AbTestRunId,
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

/// <summary>
/// Test-only request to seed an optimization theory directly in a chosen lifecycle state,
/// bypassing the asynchronous validation pipeline. <see cref="ResultingProposalId"/> is required
/// when <see cref="Status"/> is <see cref="TheoryStatus.Validated"/> so the spawned proposal is
/// resolvable. The pass-rate / p-value metrics are optional and recorded as-is.
/// </summary>
public record SeedTheoryRequest(
    Guid AgentId,
    TheoryStatus Status,
    TheorySource Source,
    Priority Priority,
    string Rationale,
    ProposalDetailsDto Details,
    double? BaselinePassRate,
    double? ProjectedPassRate,
    double? PValue,
    Guid? ResultingProposalId);
