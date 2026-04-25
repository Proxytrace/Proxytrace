using System.ComponentModel.DataAnnotations;
using System.Net;
using Trsr.Domain.Agent;
using Trsr.Domain.Internal;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Usage;

namespace Trsr.Domain.AgentCall.Internal;

internal record AgentCall : DomainEntity, IAgentCall
{
    public IAgent Agent { get; }
    public IModelEndpoint Endpoint { get; }
    public Conversation Request { get; }
    public AssistantMessage Response { get; }
    public TokenUsage Usage { get; }
    public TimeSpan Duration { get; }
    public HttpStatusCode HttpStatus { get; }
    public string? FinishReason { get; }
    public string? ErrorMessage { get; }

    public AgentCall(
        IAgent agent,
        IModelEndpoint endpoint,
        Conversation request,
        AssistantMessage response,
        TokenUsage usage,
        TimeSpan duration,
        HttpStatusCode httpStatus,
        string? finishReason,
        string? errorMessage)
    {
        Agent = agent;
        Endpoint = endpoint;
        Request = request;
        Response = response;
        Usage = usage;
        Duration = duration;
        HttpStatus = httpStatus;
        FinishReason = finishReason;
        ErrorMessage = errorMessage;
    }

    public AgentCall(
        IAgent agent,
        IModelEndpoint endpoint,
        Conversation request,
        AssistantMessage response,
        TokenUsage usage,
        TimeSpan duration,
        HttpStatusCode httpStatus,
        string? finishReason,
        string? errorMessage,
        IDomainEntityData existing) : base(existing)
    {
        Agent = agent;
        Endpoint = endpoint;
        Request = request;
        Response = response;
        Usage = usage;
        Duration = duration;
        HttpStatus = httpStatus;
        FinishReason = finishReason;
        ErrorMessage = errorMessage;
    }

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
        {
            yield return result;
        }
        
        foreach (var result in Agent.Validate(validationContext))
        {
            yield return result;
        }
        
        foreach (var result in Endpoint.Validate(validationContext))
        {
            yield return result;
        }

        foreach (var result in Request.Validate(validationContext))
        {
            yield return result;
        }
        
        foreach (var result in Response.Validate(validationContext))
        {
            yield return result;
        }
    }
}
