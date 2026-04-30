using System.ComponentModel.DataAnnotations;
using Trsr.Common.Validation;
using Trsr.Domain.AgentCall;
using Trsr.Domain.Internal;
using Trsr.Domain.Message;

namespace Trsr.Domain.AgentToolCall.Internal;

internal record AgentToolCall : DomainEntity, IAgentToolCall
{
    public IAgentCall AgentCall { get; }
    public string ToolCallId { get; }
    public ToolRequest Request { get; }
    public ToolResponse? Response { get; }
    public TimeSpan? Duration { get; }

    public AgentToolCall(
        IAgentCall agentCall,
        string toolCallId,
        ToolRequest request,
        ToolResponse? response,
        TimeSpan? duration)
    {
        AgentCall = agentCall;
        ToolCallId = toolCallId;
        Request = request;
        Response = response;
        Duration = duration;
    }

    public AgentToolCall(
        IAgentCall agentCall,
        string toolCallId,
        ToolRequest request,
        ToolResponse? response,
        TimeSpan? duration,
        IDomainEntityData existing) : base(existing)
    {
        AgentCall = agentCall;
        ToolCallId = toolCallId;
        Request = request;
        Response = response;
        Duration = duration;
    }

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
        {
            yield return result;
        }

        yield return Validation.NotNull(AgentCall, nameof(AgentCall));
        yield return Validation.NotNullOrWhiteSpace(ToolCallId, nameof(ToolCallId));
        yield return Validation.NotNull(Request, nameof(Request));

        if (Request is not null)
        {
            foreach (var result in Request.Validate(validationContext))
            {
                yield return result;
            }
        }

        if (Response is not null)
        {
            foreach (var result in Response.Validate(validationContext))
            {
                yield return result;
            }
        }
    }
}
