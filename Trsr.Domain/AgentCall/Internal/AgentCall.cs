using System.ComponentModel.DataAnnotations;
using System.Net;
using Trsr.Common.Validation;
using Trsr.Domain.Internal;
using Trsr.Domain.Message;
using Trsr.Domain.Usage;

namespace Trsr.Domain.AgentCall.Internal;

internal record AgentCall : DomainEntity, IAgentCall
{
    public string Model { get; }
    public string Provider { get; }
    public Conversation Conversation { get; }
    public AssistantMessage AgentMessage { get; }
    public TokenUsage Usage { get; }
    public TimeSpan Duration { get; }
    public HttpStatusCode HttpStatus { get; }
    public string? FinishReason { get; }
    public string? ErrorMessage { get; }

    public AgentCall(
        string model,
        string provider,
        Conversation conversation,
        AssistantMessage agentMessage,
        TokenUsage usage,
        TimeSpan duration,
        HttpStatusCode httpStatus,
        string? finishReason,
        string? errorMessage)
    {
        Model = model;
        Provider = provider;
        Conversation = conversation;
        AgentMessage = agentMessage;
        Usage = usage;
        Duration = duration;
        HttpStatus = httpStatus;
        FinishReason = finishReason;
        ErrorMessage = errorMessage;
    }

    public AgentCall(IAgentCallData existing) : base(existing)
    {
        Model = existing.Model;
        Provider = existing.Provider;
        Conversation = existing.Conversation;
        AgentMessage = existing.AgentMessage;
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
        
        foreach (var result in Conversation.Validate(validationContext))
        {
            yield return result;
        }
        
        foreach (var result in AgentMessage.Validate(validationContext))
        {
            yield return result;
        }

        yield return Validation.NotNullOrWhiteSpace(Model, nameof(Model));
        yield return Validation.NotNullOrWhiteSpace(Provider, nameof(Provider));
        
    }
}
