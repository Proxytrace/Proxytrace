namespace Trsr.Domain.AgentCall;

public record AgentCallFilter(
    Guid? AgentId = null,
    Guid? ProjectId = null,
    Guid? EndpointId = null,
    string? Model = null,
    DateTimeOffset? From = null,
    DateTimeOffset? To = null,
    int? HttpStatus = null,
    bool IncludeSystemAgents = true);
