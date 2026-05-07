using System.ComponentModel.DataAnnotations;
using System.Net;
using Trsr.Domain.Agent;
using Trsr.Domain.Completion;
using Trsr.Domain.Internal;
using Trsr.Domain.Message;
using Trsr.Domain.ModelEndpoint;

namespace Trsr.Domain.AgentCall.Internal;

internal record AgentCall : DomainEntity<IAgentCall>, IAgentCall
{
    public IAgent Agent { get; }
    public IModelEndpoint Endpoint { get; }
    public Conversation Request { get; }
    public ICompletion? Response { get; }
    public HttpStatusCode HttpStatus { get; }
    public string? FinishReason { get; }
    public string? ErrorMessage { get; }
    public Guid? ConversationId { get; }

    public AgentCall(
        IAgent agent,
        IModelEndpoint endpoint,
        Conversation request,
        ICompletion? response,
        HttpStatusCode httpStatus,
        string? finishReason,
        string? errorMessage,
        Guid? conversationId,
        IRepository<IAgentCall> repository) : base(repository)
    {
        Agent = agent;
        Endpoint = endpoint;
        Request = request;
        Response = response;
        HttpStatus = httpStatus;
        FinishReason = finishReason;
        ErrorMessage = errorMessage;
        ConversationId = conversationId;
    }

    public AgentCall(
        IAgent agent,
        IModelEndpoint endpoint,
        Conversation request,
        ICompletion? response,
        HttpStatusCode httpStatus,
        string? finishReason,
        string? errorMessage,
        IDomainEntityData existing,
        Guid? conversationId,
        IRepository<IAgentCall> repository) : base(existing, repository)
    {
        Agent = agent;
        Endpoint = endpoint;
        Request = request;
        Response = response;
        HttpStatus = httpStatus;
        FinishReason = finishReason;
        ErrorMessage = errorMessage;
        ConversationId = conversationId;
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

        if (Response is not null)
        {
            foreach (var result in Response.Validate(validationContext))
            {
                yield return result;
            }
        }
    }
}
