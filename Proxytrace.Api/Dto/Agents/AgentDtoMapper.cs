using Proxytrace.Api.Dto.Inference;
using Proxytrace.Api.Dto.Tools;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.AgentVersion;

namespace Proxytrace.Api.Dto.Agents;

/// <summary>
/// Maps <see cref="IAgent"/> domain entities to <see cref="AgentDto"/>.
/// Shared by the agents controller and aggregate view endpoints.
/// </summary>
public sealed class AgentDtoMapper
{
    private readonly ToolDtoMapper toolDtoMapper;

    public AgentDtoMapper(ToolDtoMapper toolDtoMapper)
    {
        this.toolDtoMapper = toolDtoMapper;
    }

    public AgentDto ToDto(IAgent a, DateTimeOffset? lastUsedAt) => new(
        a.Id,
        a.Project.Id,
        a.Project.Name,
        a.Name,
        a.SystemPrompt.Template,
        [.. a.Tools.Select(toolDtoMapper.ToToolSpecDto)],
        a.Endpoint.Id,
        $"{a.Endpoint.Model.Name} / {a.Endpoint.Provider.Name}",
        ModelParametersDto.FromDomain(a.ModelParameters),
        a.IsSystemAgent,
        a.CreatedAt,
        a.UpdatedAt,
        lastUsedAt);

    public AgentVersionDto ToDto(IAgentVersion v, string fingerprint) => new(
        v.Id,
        v.AgentId,
        v.VersionNumber,
        v.SystemPrompt.Template,
        [.. v.Tools.Select(toolDtoMapper.ToToolSpecDto)],
        fingerprint,
        v.CreatedAt);
}
