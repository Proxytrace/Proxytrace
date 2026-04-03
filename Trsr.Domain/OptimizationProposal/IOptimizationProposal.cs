using Trsr.Domain.Agent;
using Trsr.Domain.Message;
using Trsr.Domain.Tools;

namespace Trsr.Domain.OptimizationProposal;

/// <summary>
/// A structured, reviewable suggestion to improve an agent's system prompt and/or tools,
/// derived from test-run evidence. Proposals are always human-reviewed; there is no automatic rollout.
/// </summary>
public interface IOptimizationProposal : IDomainEntity
{
    /// <summary>The agent version this proposal targets.</summary>
    IAgent Agent { get; }

    /// <summary>Which aspect of the agent is being proposed for change.</summary>
    ProposalKind Kind { get; }

    /// <summary>Current review state of this proposal.</summary>
    ProposalStatus Status { get; }

    /// <summary>
    /// Human-readable explanation of why this proposal was generated,
    /// referencing the test evidence that motivated it.
    /// </summary>
    string Rationale { get; }

    /// <summary>
    /// The suggested new system prompt, or <c>null</c> when <see cref="Kind"/> is <see cref="ProposalKind.Tool"/>.
    /// </summary>
    SystemMessage? ProposedSystemMessage { get; }

    /// <summary>
    /// The suggested new tool definitions.
    /// Empty when <see cref="Kind"/> is <see cref="ProposalKind.SystemPrompt"/>.
    /// </summary>
    IReadOnlyCollection<ToolSpecification> ProposedTools { get; }

    /// <summary>
    /// IDs of the <see cref="TestRun.ITestRun"/> instances whose results motivated this proposal.
    /// </summary>
    IReadOnlyCollection<Guid> EvidenceTestRunIds { get; }

    /// <summary>Factory delegate for creating a new optimization proposal.</summary>
    public delegate IOptimizationProposal CreateNew(
        IAgent agent,
        ProposalKind kind,
        string rationale,
        SystemMessage? proposedSystemMessage,
        IReadOnlyCollection<ToolSpecification> proposedTools,
        IReadOnlyCollection<Guid> evidenceTestRunIds);

    /// <summary>Factory delegate for reconstituting an existing optimization proposal from persistence.</summary>
    public delegate IOptimizationProposal CreateExisting(
        IAgent agent,
        ProposalKind kind,
        ProposalStatus status,
        string rationale,
        SystemMessage? proposedSystemMessage,
        IReadOnlyCollection<ToolSpecification> proposedTools,
        IReadOnlyCollection<Guid> evidenceTestRunIds,
        IDomainEntityData existing);
}
