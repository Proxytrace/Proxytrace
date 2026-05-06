using System.Net;
using Trsr.Api.Dto.Agents;

namespace Trsr.Api.Dto.AgentCalls;

public record AgentCallDto(
    Guid Id,
    Guid? AgentId,
    string? AgentName,
    string Model,
    string Provider,
    IReadOnlyList<AgentCallMessageDto> Request,
    AgentCallMessageDto Response,
    IReadOnlyList<ToolSpecificationDto> Tools,
    long InputTokens,
    long OutputTokens,
    double DurationMs,
    int HttpStatus,
    string? FinishReason,
    string? ErrorMessage,
    decimal? CostEur,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    Guid? ConversationId);

public record AgentCallMessageDto(string Role, string Content, IReadOnlyList<AgentCallToolRequestDto> ToolRequests, string? ToolCallId = null);

public record AgentCallToolRequestDto(string Id, string Name, string Arguments);
