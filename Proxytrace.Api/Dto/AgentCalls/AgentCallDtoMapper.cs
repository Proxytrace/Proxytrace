using System.Text.Json;
using Proxytrace.Api.Dto.Agents;
using Proxytrace.Api.Dto.Inference;
using Proxytrace.Domain.AgentCall;
using Proxytrace.Domain.Message;
using Proxytrace.Domain.Tools;

namespace Proxytrace.Api.Dto.AgentCalls;

/// <summary>
/// Maps <see cref="IAgentCall"/> domain entities to <see cref="AgentCallDto"/>.
/// Shared by the agent-calls controller and aggregate view endpoints.
/// </summary>
internal static class AgentCallDtoMapper
{
    public static AgentCallDto ToDto(IAgentCall c) => new(
        c.Id,
        c.Agent.Id,
        c.Agent.Name,
        c.Endpoint.Model.Name,
        c.Endpoint.Provider.Name,
        c.Request.Messages.Select(ToMessageDto).ToArray(),
        c.Response != null ? ToMessageDto(c.Response.Response) : null,
        c.Agent.Tools.Select(ToToolSpecDto).ToArray(),
        c.Response?.Usage?.InputTokenCount,
        c.Response?.Usage?.OutputTokenCount,
        c.Response?.Latency.TotalMilliseconds,
        (int)c.HttpStatus,
        c.FinishReason,
        c.ErrorMessage,
        ComputeCost(c),
        ModelParametersDto.FromDomain(c.ModelParameters),
        c.CreatedAt,
        c.UpdatedAt,
        c.ConversationId);

    private static ToolSpecificationDto ToToolSpecDto(ToolSpecification t) => new(
        t.Name,
        t.Description,
        t.Arguments.Arguments.Select(ToToolArgumentDto).ToArray());

    private static ToolArgumentDto ToToolArgumentDto(IToolArgument arg)
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

    private static AgentCallMessageDto ToMessageDto(Message m) => m switch
    {
        AssistantMessage a => new AgentCallMessageDto(
            "assistant",
            a.GetText(),
            a.ToolRequests.Select(tr => new AgentCallToolRequestDto(tr.Id, tr.Name, tr.Arguments)).ToArray()),
        ToolMessage t => new AgentCallMessageDto("tool", t.GetText(), [], GetToolCallId(t)),
        _ => new AgentCallMessageDto(m.Role.ToString().ToLower(), m.GetText(), [])
    };

    private static string GetToolCallId(ToolMessage t)
        => t.Contents.Count > 0 ? t.Contents[0].Text ?? "" : "";

    private static decimal? ComputeCost(IAgentCall c)
    {
        var e = c.Endpoint;
        if (e.InputTokenCost is null || e.OutputTokenCost is null)
        {
            return null;
        }

        var usage = c.Response?.Usage;
        return usage != null ? c.Endpoint.CalculateCost(usage) : null;
    }

}
