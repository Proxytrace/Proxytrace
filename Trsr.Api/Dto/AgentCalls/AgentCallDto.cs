using System.Net;

namespace Trsr.Api.Dto.AgentCalls;

public record AgentCallDto(
    Guid Id,
    Guid? AgentId,
    string Model,
    string Provider,
    IReadOnlyList<AgentCallMessageDto> Request,
    AgentCallMessageDto Response,
    long InputTokens,
    long OutputTokens,
    double DurationMs,
    int HttpStatus,
    string? FinishReason,
    string? ErrorMessage,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public record AgentCallMessageDto(string Role, string Content);
