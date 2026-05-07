using Trsr.Domain.OptimizationProposal;
using Trsr.Domain.Proposal;

namespace Trsr.Api.Dto.Proposals;

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
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt
);

public record UpdateProposalStatusRequest(ProposalStatus Status);
