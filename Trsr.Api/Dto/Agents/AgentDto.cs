using Trsr.Api.Dto.Inference;

namespace Trsr.Api.Dto.Agents;

public record AgentDto(
    Guid Id,
    Guid ProjectId,
    string ProjectName,
    string Name,
    string SystemMessage,
    IReadOnlyList<ToolSpecificationDto> Tools,
    Guid EndpointId,
    string EndpointName,
    ModelParametersDto ModelParameters,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    DateTimeOffset? LastUsedAt);

public record UpdateAgentEndpointRequest(Guid EndpointId);

public record ToolSpecificationDto(
    string Name,
    string Description,
    IReadOnlyList<ToolArgumentDto> Arguments);

public record ToolArgumentDto(
    string Name,
    string? Description,
    string Type,
    bool IsRequired,
    IReadOnlyList<string>? EnumValues);
