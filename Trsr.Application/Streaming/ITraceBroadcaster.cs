using System.Threading.Channels;
using Trsr.Domain.AgentCall;

namespace Trsr.Application.Streaming;

public record TraceCreatedEvent(
    Guid Id,
    Guid AgentId,
    string AgentName,
    string Model,
    string Provider,
    DateTimeOffset CreatedAt,
    Guid? ConversationId)
{
    public static TraceCreatedEvent Create(IAgentCall call)
        => new(
            call.Id,
            call.Agent.Id,
            call.Agent.Name,
            call.Endpoint.Model.Name,
            call.Endpoint.Provider.Name,
            call.CreatedAt,
            call.ConversationId);
}

public interface ITraceBroadcaster
{
    ChannelReader<TraceCreatedEvent> Subscribe(CancellationToken cancellationToken);
    
    void Publish(TraceCreatedEvent evt);
}