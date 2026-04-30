using Trsr.Domain.AgentCall;
using Trsr.Domain.Message;

namespace Trsr.Domain.AgentToolCall;

/// <summary>
/// Records a single tool call requested by the assistant inside an <see cref="IAgentCall"/>.
/// The <see cref="Response"/> and <see cref="Duration"/> are populated when the next call
/// returns the tool result; they are <see langword="null"/> while the request is pending.
/// </summary>
public interface IAgentToolCall : IDomainEntity
{
    /// <summary>The agent call this tool call belongs to.</summary>
    IAgentCall AgentCall { get; }

    /// <summary>The provider-issued tool call identifier (e.g. <c>call_abc123</c>).</summary>
    string ToolCallId { get; }

    /// <summary>The tool invocation requested by the assistant.</summary>
    ToolRequest Request { get; }

    /// <summary>The result of the tool invocation, or <see langword="null"/> while pending.</summary>
    ToolResponse? Response { get; }

    /// <summary>How long the tool result took to arrive, or <see langword="null"/> while pending.</summary>
    TimeSpan? Duration { get; }

    public delegate IAgentToolCall CreateNew(
        IAgentCall agentCall,
        string toolCallId,
        ToolRequest request,
        ToolResponse? response,
        TimeSpan? duration);

    public delegate IAgentToolCall CreateExisting(
        IAgentCall agentCall,
        string toolCallId,
        ToolRequest request,
        ToolResponse? response,
        TimeSpan? duration,
        IDomainEntityData existing);
}
