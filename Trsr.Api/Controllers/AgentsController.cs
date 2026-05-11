using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Trsr.Api.Dto;
using Trsr.Api.Dto.Agents;
using Trsr.Api.Dto.Inference;
using Trsr.Application.Streaming;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.AgentCall;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Tools;

namespace Trsr.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/agents")]
public class AgentsController : ControllerBase
{
    private static readonly JsonSerializerOptions SseOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Converters = { new JsonStringEnumConverter() },
    };

    private readonly IAgentRepository repository;
    private readonly IRepository<IModelEndpoint> endpoints;
    private readonly IAgentCallRepository agentCallRepository;
    private readonly IProposalBroadcaster proposalBroadcaster;

    public AgentsController(
        IAgentRepository repository,
        IRepository<IModelEndpoint> endpoints,
        IAgentCallRepository agentCallRepository,
        IProposalBroadcaster proposalBroadcaster)
    {
        this.repository = repository;
        this.endpoints = endpoints;
        this.agentCallRepository = agentCallRepository;
        this.proposalBroadcaster = proposalBroadcaster;
    }

    [HttpGet]
    public async Task<PagedResult<AgentDto>> GetAll(
        [FromQuery] Guid? projectId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var all = await repository.GetAllAsync(cancellationToken);
        var filtered = projectId.HasValue
            ? all.Where(a => a.Project.Id == projectId.Value).ToArray()
            : all;

        var lastCallTimes = await agentCallRepository.GetLastCallTimesAsync(cancellationToken);

        var sorted = filtered
            .OrderByDescending(a => lastCallTimes.TryGetValue(a.Id, out var t) ? t : DateTimeOffset.MinValue)
            .ThenByDescending(a => a.UpdatedAt)
            .ToArray();

        var items = sorted.Skip((page - 1) * pageSize).Take(pageSize)
            .Select(a => ToDto(a, lastCallTimes.TryGetValue(a.Id, out var t) ? t : null))
            .ToArray();

        return new PagedResult<AgentDto>(items, filtered.Count(), page, pageSize);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<AgentDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        if (!await repository.ContainsAsync(id, cancellationToken))
            return NotFound();
        var agent = await repository.GetAsync(id, cancellationToken);
        var lastCallTimes = await agentCallRepository.GetLastCallTimesAsync(cancellationToken);
        return ToDto(agent, lastCallTimes.TryGetValue(agent.Id, out var t) ? t : null);
    }

    [HttpGet("{id:guid}/proposals/stream")]
    public async Task StreamProposals(Guid id, CancellationToken cancellationToken)
    {
        if (!await repository.ContainsAsync(id, cancellationToken))
        {
            Response.StatusCode = 404;
            return;
        }

        Response.Headers.Append("Content-Type", "text/event-stream");
        Response.Headers.Append("Cache-Control", "no-cache");
        Response.Headers.Append("X-Accel-Buffering", "no");

        var reader = proposalBroadcaster.Subscribe(id, cancellationToken);
        await foreach (var evt in reader.ReadAllAsync(cancellationToken))
        {
            var data = JsonSerializer.Serialize(evt, SseOptions);
            await Response.WriteAsync($"event: proposal-created\ndata: {data}\n\n", cancellationToken);
            await Response.Body.FlushAsync(cancellationToken);
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var removed = await repository.RemoveAsync(id, cancellationToken);
        return removed ? NoContent() : NotFound();
    }

    [HttpPatch("{id:guid}/endpoint")]
    public async Task<IActionResult> UpdateEndpoint(
        Guid id, 
        [FromBody] UpdateAgentEndpointRequest request,
        CancellationToken cancellationToken)
    {
        IAgent agent = await repository.GetAsync(id, cancellationToken);
        IModelEndpoint endpoint = await endpoints.GetAsync(request.EndpointId, cancellationToken);
        await agent.ChangeEndpoint(endpoint, cancellationToken);
        return NoContent();
    }

    private static AgentDto ToDto(IAgent a, DateTimeOffset? lastUsedAt) => new(
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
