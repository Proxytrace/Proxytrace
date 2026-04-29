using Microsoft.AspNetCore.Mvc;
using Trsr.Api.Dto;
using Trsr.Api.Dto.AgentCalls;
using Trsr.Domain.AgentCall;
using Trsr.Domain.Message;

namespace Trsr.Api.Controllers;

[ApiController]
[Route("api/agent-calls")]
public class AgentCallsController : ControllerBase
{
    private readonly IAgentCallRepository repository;

    public AgentCallsController(IAgentCallRepository repository)
    {
        this.repository = repository;
    }

    [HttpGet]
    public async Task<PagedResult<AgentCallDto>> GetAll(
        [FromQuery] Guid? projectId = null,
        [FromQuery] Guid? agentId = null,
        [FromQuery] Guid? endpointId = null,
        [FromQuery] string? model = null,
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        [FromQuery] int? httpStatus = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var filter = new AgentCallFilter(agentId, projectId, endpointId, model, from, to, httpStatus);
        var (items, total) = await repository.GetFilteredAsync(filter, page, pageSize, cancellationToken);
        return new PagedResult<AgentCallDto>(items.Select(ToDto).ToArray(), total, page, pageSize);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<AgentCallDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        if (!await repository.ContainsAsync(id, cancellationToken))
            return NotFound();
        var call = await repository.GetAsync(id, cancellationToken);
        return ToDto(call);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var removed = await repository.RemoveAsync(id, cancellationToken);
        return removed ? NoContent() : NotFound();
    }

    private static AgentCallDto ToDto(IAgentCall c) => new(
        c.Id,
        c.Agent.Id,
        c.Agent.Name,
        c.Endpoint.Model.Name,
        c.Endpoint.Provider.Name,
        c.Request.Messages.Select(m => new AgentCallMessageDto(m.Role.ToString().ToLower(), GetText(m))).ToArray(),
        new AgentCallMessageDto("assistant", GetText(c.Response)),
        (long)c.Usage.InputTokenCount,
        (long)c.Usage.OutputTokenCount,
        c.Duration.TotalMilliseconds,
        (int)c.HttpStatus,
        c.FinishReason,
        c.ErrorMessage,
        ComputeCost(c),
        c.CreatedAt,
        c.UpdatedAt);

    private static decimal? ComputeCost(IAgentCall c)
    {
        var e = c.Endpoint;
        if (e.InputTokenCost is null || e.OutputTokenCost is null)
        {
            return null;
        }
        return (c.Usage.InputTokenCount / 1_000_000m) * e.InputTokenCost.Value
             + (c.Usage.OutputTokenCount / 1_000_000m) * e.OutputTokenCost.Value;
    }

    private static string GetText(Message m) => m switch
    {
        UserMessage u => string.Concat(u.Contents.Select(c => c.Text ?? "")),
        AssistantMessage a => string.Concat(a.Contents.Select(c => c.Text ?? "")),
        SystemMessage s => string.Concat(s.Contents.Select(c => c.Text ?? "")),
        ToolMessage t => t.Contents.Count > 1 ? t.Contents[1].Text ?? "" : "",
        _ => ""
    };

    private static string GetText(AssistantMessage m)
        => string.Concat(m.Contents.Select(c => c.Text ?? ""));
}
