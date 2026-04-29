using System.Net;

namespace Trsr.Api.Dto.AgentCalls;

public record AgentCallDto(
    Guid Id,
    Guid? AgentId,
    string? AgentName,
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
    decimal? CostEur,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public record AgentCallMessageDto(string Role, string Content, IReadOnlyList<AgentCallToolRequestDto> ToolRequests, string? ToolCallId = null);

public record AgentCallToolRequestDto(string Id, string Name, string Arguments);
