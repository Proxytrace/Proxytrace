using Trsr.Api.Dto.Agents;
using Trsr.Api.Dto.Inference;

namespace Trsr.Api.Dto.AgentCalls;

public record AgentCallDto(
    Guid Id,
    Guid? AgentId,
    string? AgentName,
    string Model,
    string Provider,
    IReadOnlyList<AgentCallMessageDto> Request,
    AgentCallMessageDto? Response,
    IReadOnlyList<ToolSpecificationDto> Tools,
    ulong? InputTokens,
    ulong? OutputTokens,
    double? DurationMs,
    int HttpStatus,
    string? FinishReason,
    string? ErrorMessage,
    decimal? CostEur,
    ModelParametersDto ModelParameters,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    Guid? ConversationId);

public record AgentCallMessageDto(string Role, string Content, IReadOnlyList<AgentCallToolRequestDto> ToolRequests, string? ToolCallId = null);

public record AgentCallToolRequestDto(string Id, string Name, string Arguments);
