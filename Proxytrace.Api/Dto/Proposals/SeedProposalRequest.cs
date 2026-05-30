using Proxytrace.Domain.OptimizationProposal;
using Proxytrace.Domain.Proposal;

namespace Proxytrace.Api.Dto.Proposals;

/// <summary>
/// Test-only request to seed an optimization proposal directly, bypassing the optimizer pipeline.
/// Mirrors the shape produced by the optimizers so the seeded proposal reads back identically.
/// </summary>
public record SeedProposalRequest(
    Guid AgentId,
    ProposalKind Kind,
    ProposalStatus Status,
    Priority Priority,
    string Rationale,
    ProposalDetailsDto Details);
