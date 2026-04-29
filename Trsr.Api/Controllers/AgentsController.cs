using Microsoft.AspNetCore.Mvc;
using Trsr.Api.Dto;
using Trsr.Api.Dto.Agents;
using Trsr.Domain.Agent;
using Trsr.Domain.Message;

namespace Trsr.Api.Controllers;

[ApiController]
[Route("api/agents")]
public class AgentsController : ControllerBase
{
    private readonly IAgentRepository repository;

    public AgentsController(IAgentRepository repository)
    {
        this.repository = repository;
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
        var items = filtered.Skip((page - 1) * pageSize).Take(pageSize).Select(ToDto).ToArray();
        return new PagedResult<AgentDto>(items, filtered.Count(), page, pageSize);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<AgentDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        if (!await repository.ContainsAsync(id, cancellationToken))
            return NotFound();
        var agent = await repository.GetAsync(id, cancellationToken);
        return ToDto(agent);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var removed = await repository.RemoveAsync(id, cancellationToken);
        return removed ? NoContent() : NotFound();
    }

    private static AgentDto ToDto(IAgent a) => new(
        a.Id,
        a.Project.Id,
        a.Project.Name,
        a.Name,
        GetSystemMessageText(a.SystemMessage),
        a.Tools.Select(t => new ToolSpecificationDto(t.Name, t.Description)).ToArray(),
        a.CreatedAt,
        a.UpdatedAt);

    private static string GetSystemMessageText(SystemMessage msg)
        => string.Concat(msg.Contents.Select(c => c.Text ?? ""));
}
