using System.Net;

namespace Trsr.Api.Dto.AgentCalls;

public record AgentCallDto(
    Guid Id,
    Guid? AgentId,
    string Model,
    string Provider,
    IReadOnlyList<MessageDto> Request,
    MessageDto Response,
    long InputTokens,
    long OutputTokens,
    double DurationMs,
    int HttpStatus,
    string? FinishReason,
    string? ErrorMessage,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public record MessageDto(string Role, string Content);
