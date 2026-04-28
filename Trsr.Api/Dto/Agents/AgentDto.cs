namespace Trsr.Api.Dto.Agents;

public record AgentDto(
    Guid Id,
    Guid ProjectId,
    string ProjectName,
    string Name,
    string SystemMessage,
    IReadOnlyList<ToolSpecificationDto> Tools,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public record ToolSpecificationDto(string Name, string Description);
