using Trsr.Domain.Agent;
using Trsr.Domain.Proposal;
using Trsr.Domain.Tools;

namespace Trsr.Domain.OptimizationProposal;

/// <summary>
/// Proposal to update the agent's tool definitions.
/// </summary>
public interface IToolUpdateProposal : IOptimizationProposal
{
    /// <summary>The proposed tool specifications, replacing the agent's current ones.</summary>
    IReadOnlyList<ToolSpecification> ProposedTools { get; }

    public delegate IToolUpdateProposal CreateNew(
        IAgent agent,
        Priority priority,
        string rationale,
        IReadOnlyList<ToolSpecification> proposedTools,
        IReadOnlyCollection<Guid> evidenceTestRunIds);

    public delegate IToolUpdateProposal CreateExisting(
        IAgent agent,
        ProposalStatus status,
        Priority priority,
        string rationale,
        IReadOnlyList<ToolSpecification> proposedTools,
        IReadOnlyCollection<Guid> evidenceTestRunIds,
        IDomainEntityData existing);
}
