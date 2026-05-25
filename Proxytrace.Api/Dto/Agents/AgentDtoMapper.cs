using System.Text.Json;
using Proxytrace.Api.Dto.Inference;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.Tools;

namespace Proxytrace.Api.Dto.Agents;

/// <summary>
/// Maps <see cref="IAgent"/> domain entities to <see cref="AgentDto"/>.
/// Shared by the agents controller and aggregate view endpoints.
/// </summary>
internal static class AgentDtoMapper
{
    public static AgentDto ToDto(IAgent a, DateTimeOffset? lastUsedAt) => new(
        a.Id,
        a.Project.Id,
        a.Project.Name,
        a.Name,
        a.SystemPrompt.Template,
        a.Tools.Select(t => new ToolSpecificationDto(
            t.Name,
            t.Description,
            t.Arguments.Arguments.Select(ToArgumentDto).ToArray()
        )).ToArray(),
        a.Endpoint.Id,
        $"{a.Endpoint.Model.Name} / {a.Endpoint.Provider.Name}",
        ModelParametersDto.FromDomain(a.ModelParameters),
        a.IsSystemAgent,
        a.CreatedAt,
        a.UpdatedAt,
        lastUsedAt);

    private static ToolArgumentDto ToArgumentDto(IToolArgument arg)
    {
        var type = "object";
        List<string>? enumValues = null;
        try
        {
            using var doc = JsonDocument.Parse(arg.JsonSchema);
            var root = doc.RootElement;
            if (root.TryGetProperty("type", out var typeEl))
                type = typeEl.GetString() ?? "object";
            if (root.TryGetProperty("enum", out var enumEl) && enumEl.ValueKind == JsonValueKind.Array)
                enumValues = [.. enumEl.EnumerateArray().Select(e => e.GetString() ?? "")];
        }
        catch
        {
            // ignored
        }

        return new ToolArgumentDto(arg.Name, arg.Description, type, arg.IsRequired, enumValues);
    }
}
