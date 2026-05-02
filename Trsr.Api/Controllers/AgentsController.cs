using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Trsr.Api.Dto;
using Trsr.Api.Dto.Agents;
using Trsr.Domain;
using Trsr.Domain.Agent;
using Trsr.Domain.AgentCall;
using Trsr.Domain.Message;
using Trsr.Domain.Tools;

namespace Trsr.Api.Controllers;

[ApiController]
[Route("api/agents")]
public class AgentsController : ControllerBase
{
    private readonly IAgentRepository repository;
    private readonly IAgentCallRepository agentCallRepository;

    public AgentsController(IAgentRepository repository, IAgentCallRepository agentCallRepository)
    {
        this.repository = repository;
        this.agentCallRepository = agentCallRepository;
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

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var removed = await repository.RemoveAsync(id, cancellationToken);
        return removed ? NoContent() : NotFound();
    }

    private static AgentDto ToDto(IAgent a, DateTimeOffset? lastUsedAt) => new(
        a.Id,
        a.Project.Id,
        a.Project.Name,
        a.Name,
        GetSystemMessageText(a.SystemMessage),
        a.Tools.Select(t => new ToolSpecificationDto(
            t.Name,
            t.Description,
            t.Arguments.Arguments.Select(ToArgumentDto).ToArray()
        )).ToArray(),
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
        catch { }
        return new ToolArgumentDto(arg.Name, arg.Description, type, arg.IsRequired, enumValues);
    }

    private static string GetSystemMessageText(SystemMessage msg)
        => string.Concat(msg.Contents.Select(c => c.Text ?? ""));
}
