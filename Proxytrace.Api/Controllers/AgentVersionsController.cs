using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Proxytrace.Api.Dto.Agents;
using Proxytrace.Domain;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.AgentVersion;

namespace Proxytrace.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/agent-versions")]
public class AgentVersionsController : ControllerBase
{
    private readonly IAgentVersionRepository versions;
    private readonly IAgentRepository agents;
    private readonly ITransaction transaction;
    private readonly AgentDtoMapper mapper;

    public AgentVersionsController(
        IAgentVersionRepository versions,
        IAgentRepository agents,
        ITransaction transaction,
        AgentDtoMapper mapper)
    {
        this.versions = versions;
        this.agents = agents;
        this.transaction = transaction;
        this.mapper = mapper;
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<AgentVersionDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var version = await versions.FindAsync(id, cancellationToken);
        if (version is null)
        {
            return NotFound();
        }
        var fingerprint = versions.GetStrictFingerprint(version.SystemPrompt, version.Tools);
        return mapper.ToDto(version, fingerprint);
    }

    [HttpPost("{id:guid}/move")]
    public async Task<IActionResult> Move(
        Guid id,
        [FromBody] MoveVersionRequest request,
        CancellationToken cancellationToken)
    {
        var version = await versions.FindAsync(id, cancellationToken);
        if (version is null)
        {
            return NotFound("Version not found.");
        }

        var source = await version.GetAgentAsync(cancellationToken);
        var target = await agents.FindAsync(request.TargetAgentId, cancellationToken);
        if (target is null)
        {
            return NotFound("Target agent not found.");
        }
        if (target.Id == source.Id)
        {
            return BadRequest("Target agent is the same as the source.");
        }
        if (target.Project.Id != source.Project.Id)
        {
            return BadRequest("Target agent is in a different project.");
        }
        if (source.IsSystemAgent || target.IsSystemAgent)
        {
            return BadRequest("Cannot move versions into or out of a system agent.");
        }

        await transaction.InvokeAsync(async () =>
        {
            await version.MoveToAgentAsync(target, cancellationToken);
            await agents.SetCurrentVersionAsync(target.Id, version.Id, cancellationToken);

            var remaining = await versions.GetByAgentAsync(source, cancellationToken);
            if (remaining.Count == 0)
            {
                await agents.RemoveAsync(source.Id, cancellationToken);
            }
            else
            {
                var newest = remaining.OrderByDescending(v => v.VersionNumber).First();
                if (source.CurrentVersion.Id != newest.Id)
                {
                    await agents.SetCurrentVersionAsync(source.Id, newest.Id, cancellationToken);
                }
            }
        });

        return NoContent();
    }
}
