namespace Trsr.Domain.AgentCall;

public record AgentCallFilter(
    Guid? AgentId = null,
    Guid? ProjectId = null,
    Guid? EndpointId = null,
    DateTimeOffset? From = null,
    DateTimeOffset? To = null,
    int? HttpStatus = null);
