using Proxytrace.Domain.OptimizationProposal;
using Proxytrace.Domain.Proposal;

namespace Proxytrace.Api.Dto.Proposals;

public record OptimizationProposalDto(
    Guid Id,
    ProposalKind Kind,
    ProposalStatus Status,
    Guid AgentId,
    string AgentName,
    Priority Priority,
    string Rationale,
    ProposalDetailsDto Details,
    Guid[] EvidenceTestRunIds,
    AbTestRunSummaryDto? AbTestRun,
    double? CurrentPassRate,
    double? ProposedPassRate,
    double? ExpectedPassRateDelta,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt
);

public record UpdateProposalStatusRequest(ProposalStatus Status);
