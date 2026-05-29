using Proxytrace.Domain.Agent;
using Proxytrace.Domain.Proposal;
using Proxytrace.Domain.TestRun;

namespace Proxytrace.Domain.OptimizationProposal;

/// <summary>
/// Proposal to change the agent's system prompt.
/// </summary>
public interface ISystemPromptProposal : IOptimizationProposal
{
    /// <summary>The full proposed system prompt text.</summary>
    string ProposedSystemMessage { get; }

    public delegate ISystemPromptProposal CreateNew(
        IAgent agent,
        Priority priority,
        string rationale,
        string proposedSystemMessage,
        double? currentPassRate,
        double? proposedPassRate,
        IReadOnlyCollection<Guid> evidenceTestRunIds,
        ITestRun abTestRun);

    public delegate ISystemPromptProposal CreateExisting(
        IAgent agent,
        ProposalStatus status,
        Priority priority,
        string rationale,
        string proposedSystemMessage,
        double? currentPassRate,
        double? proposedPassRate,
        IReadOnlyCollection<Guid> evidenceTestRunIds,
        ITestRun abTestRun,
        string contentHash,
        IDomainEntityData existing);
}
