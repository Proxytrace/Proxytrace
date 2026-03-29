using System.ComponentModel.DataAnnotations;
using System.Net;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;
using Trsr.Domain.Message;
using Trsr.Domain.Usage;

namespace Trsr.Domain.AgentCall.Internal;

internal record AgentCall : DomainEntity, IAgentCall
{
    public Guid AgentId { get; }
    public string Model { get; }
    public string Provider { get; }
    public Conversation Request { get; }
    public AssistantMessage Response { get; }
    public TokenUsage Usage { get; }
    public TimeSpan Duration { get; }
    public HttpStatusCode HttpStatus { get; }
    public string? FinishReason { get; }
    public string? ErrorMessage { get; }

    public AgentCall(
        Guid agentId,
        string model,
        string provider,
        Conversation request,
        AssistantMessage response,
        TokenUsage usage,
        TimeSpan duration,
        HttpStatusCode httpStatus,
        string? finishReason,
        string? errorMessage)
    {
        AgentId = agentId;
        Model = model;
        Provider = provider;
        Request = request;
        Response = response;
        Usage = usage;
        Duration = duration;
        HttpStatus = httpStatus;
        FinishReason = finishReason;
        ErrorMessage = errorMessage;
    }

    public AgentCall(IAgentCallData existing) : base(existing)
    {
        AgentId = existing.AgentId;
        Model = existing.Model;
        Provider = existing.Provider;
        Request = existing.Request;
        Response = existing.Response;
        Usage = existing.Usage;
        Duration = existing.Duration;
        HttpStatus = existing.HttpStatus;
        FinishReason = existing.FinishReason;
        ErrorMessage = existing.ErrorMessage;
    }

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
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

        yield return Validation.NotNullOrWhiteSpace(Model, nameof(Model));
        yield return Validation.NotNullOrWhiteSpace(Provider, nameof(Provider));
        
    }
}
