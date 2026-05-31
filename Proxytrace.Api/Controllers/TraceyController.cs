using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Proxytrace.Api.Dto.Tracey;
using Proxytrace.Application.Tracey;
using Proxytrace.Domain;
using Proxytrace.Domain.Project;

namespace Proxytrace.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/tracey")]
public class TraceyController : ControllerBase
{
    private readonly ITraceySessionService sessionService;
    private readonly IRepository<IProject> projects;

    public TraceyController(
        ITraceySessionService sessionService,
        IRepository<IProject> projects)
    {
        this.sessionService = sessionService;
        this.projects = projects;
    }

    /// <summary>
    /// Mints a short-lived Tracey browser session for the given (or first) project.
    /// </summary>
    [HttpGet("session")]
    public async Task<ActionResult<TraceySessionDto>> GetSession(
        [FromQuery] Guid? projectId = null,
        CancellationToken cancellationToken = default)
    {
        IProject? project = projectId.HasValue
            ? await projects.FindAsync(projectId.Value, cancellationToken)
            : await projects.FindFirstAsync(cancellationToken);
        if (project is null)
        {
            return NotFound();
        }

        var session = await sessionService.CreateSessionAsync(project, cancellationToken);
        return new TraceySessionDto(session.Model, session.AgentId);
    }
}
