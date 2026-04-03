namespace Trsr.Domain.OptimizationProposal;

/// <summary>
/// Identifies which aspect of an agent a proposal targets.
/// </summary>
public enum ProposalKind
{
    /// <summary>The proposal suggests changes to the agent's system prompt only.</summary>
    SystemPrompt,

    /// <summary>The proposal suggests changes to the agent's tool definitions only.</summary>
    Tool,

    /// <summary>The proposal suggests changes to both the system prompt and tool definitions.</summary>
    Both,
}
