using Trsr.Domain.Agent;

namespace Trsr.Domain.AgentToolCall;

/// <summary>
/// Repository for <see cref="IAgentToolCall"/> entities, with index-based lookup by
/// provider-issued tool call ids.
/// </summary>
public interface IAgentToolCallRepository : IRepository<IAgentToolCall>
{
    /// <summary>
    /// Returns all tool calls associated with the given agent call, ordered by creation time.
    /// </summary>
    Task<IReadOnlyList<IAgentToolCall>> GetByAgentCallAsync(
        Guid agentCallId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Looks up the agent call id whose tool requests match any of the given <paramref name="toolCallIds"/>
    /// for the given <paramref name="agent"/>. Returns the most recent match, or <see langword="null"/>
    /// if none. Used to detect tool-call continuations during ingestion.
    /// </summary>
    Task<Guid?> FindAgentCallIdByToolCallIdsAsync(
        IReadOnlyCollection<string> toolCallIds,
        IAgent agent,
        CancellationToken cancellationToken = default);
}
