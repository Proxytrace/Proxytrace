namespace Trsr.Domain.AgentCall;

public record AgentCallFilter(
    Guid? AgentId = null,
    Guid? ProjectId = null,
    string? Model = null,
    string? Provider = null,
    DateTimeOffset? From = null,
    DateTimeOffset? To = null,
    int? HttpStatus = null);
