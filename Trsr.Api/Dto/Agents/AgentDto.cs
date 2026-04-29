namespace Trsr.Api.Dto.Agents;

public record AgentDto(
    Guid Id,
    Guid ProjectId,
    string ProjectName,
    string Name,
    string SystemMessage,
    IReadOnlyList<ToolSpecificationDto> Tools,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    DateTimeOffset? LastUsedAt);

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
