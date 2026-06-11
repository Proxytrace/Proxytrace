using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Proxytrace.Api.Dto.Projects;
using Proxytrace.Application.Evaluator;
using Proxytrace.Application.Tracey;
using Proxytrace.Domain;
using Proxytrace.Domain.Agent;
using Proxytrace.Domain.ModelEndpoint;
using Proxytrace.Domain.Paging;
using Proxytrace.Domain.Project;
using Proxytrace.Domain.User;

namespace Proxytrace.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/projects")]
public class ProjectsController : ControllerBase
{
    private readonly IProjectRepository repository;
    private readonly IRepository<IModelEndpoint> endpointRepository;
    private readonly IRepository<IUser> userRepository;
    private readonly IAgentRepository agentRepository;
    private readonly IProject.CreateNew createNew;
    private readonly IProject.CreateExisting createExisting;
    private readonly ITraceyAgentProvisioner traceyProvisioner;
    private readonly IDefaultEvaluatorProvisioner defaultEvaluatorProvisioner;

    public ProjectsController(
        IProjectRepository repository,
        IRepository<IModelEndpoint> endpointRepository,
        IRepository<IUser> userRepository,
        IAgentRepository agentRepository,
        IProject.CreateNew createNew,
        IProject.CreateExisting createExisting,
        ITraceyAgentProvisioner traceyProvisioner,
        IDefaultEvaluatorProvisioner defaultEvaluatorProvisioner)
    {
        this.repository = repository;
        this.endpointRepository = endpointRepository;
        this.userRepository = userRepository;
        this.agentRepository = agentRepository;
        this.createNew = createNew;
        this.createExisting = createExisting;
        this.traceyProvisioner = traceyProvisioner;
        this.defaultEvaluatorProvisioner = defaultEvaluatorProvisioner;
    }

    [HttpGet]
    public async Task<PagedResult<ProjectListItemDto>> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var paged = await repository.GetPagedAsync(page, pageSize, cancellationToken);
        return paged.Map(ProjectDtoMapper.ToListItemDto);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ProjectDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var project = await repository.FindAsync(id, cancellationToken);
        if (project is null)
            return NotFound();
        return ToDto(project);
    }

    [HttpPost]
    [Authorize(Roles = nameof(UserRole.Admin))]
    public async Task<ActionResult<ProjectDto>> Create(
        [FromBody] CreateProjectRequest request,
        CancellationToken cancellationToken)
    {
        var endpoint = await endpointRepository.FindAsync(request.SystemEndpointId, cancellationToken);
        if (endpoint is null)
            return BadRequest($"SystemEndpoint {request.SystemEndpointId} not found.");

        var members = await ResolveMembersAsync(request.MemberIds, cancellationToken);
        if (members is null)
            return BadRequest("One or more memberIds reference unknown users.");

        var project = createNew(request.Name, endpoint, members);
        var saved = await repository.AddAsync(project, cancellationToken);
        await traceyProvisioner.EnsureTraceyAgentAsync(saved, cancellationToken);
        await defaultEvaluatorProvisioner.EnsureDefaultEvaluatorsAsync(saved, cancellationToken);
        return CreatedAtAction(nameof(Get), new { id = saved.Id }, ToDto(saved));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = nameof(UserRole.Admin))]
    public async Task<ActionResult<ProjectDto>> Update(
        Guid id,
        [FromBody] UpdateProjectRequest request,
        CancellationToken cancellationToken)
    {
        var existing = await repository.FindAsync(id, cancellationToken);
        if (existing is null)
            return NotFound();
        var endpoint = existing.SystemEndpoint.Id == request.SystemEndpointId
            ? existing.SystemEndpoint
            : await endpointRepository.GetAsync(request.SystemEndpointId, cancellationToken);

        var members = request.MemberIds is null
            ? existing.Members
            : await ResolveMembersAsync(request.MemberIds, cancellationToken);
        if (members is null)
            return BadRequest("One or more memberIds reference unknown users.");

        var updated = createExisting(request.Name, endpoint, members, existing);
        var saved = await repository.UpdateAsync(updated, cancellationToken);
        return ToDto(saved);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = nameof(UserRole.Admin))]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        if (!await repository.ContainsAsync(id, cancellationToken))
            return NotFound();

        // Every project carries a built-in Tracey system agent, auto-provisioned on creation. It is
        // internal plumbing, not user data, so it must not block deletion — remove it first. Any
        // user-created agents, however, DO block deletion (the Agent→Project FK is Restrict by
        // design): refuse with a clear 409 rather than letting the FK surface as a 500.
        var agents = await agentRepository.GetByProjectAsync(id, cancellationToken);
        if (agents.Any(a => !a.IsSystemAgent))
            return Conflict(new { error = "This project still has agents. Delete its agents before deleting the project." });

        foreach (var systemAgent in agents.Where(a => a.IsSystemAgent))
            await agentRepository.RemoveAsync(systemAgent.Id, cancellationToken);

        try
        {
            var removed = await repository.RemoveAsync(id, cancellationToken);
            return removed ? NoContent() : NotFound();
        }
        catch (DbUpdateException)
        {
            // Some other Restrict FK still references the project (e.g. issued API keys). Surface a
            // clear 409 instead of a 500.
            return Conflict(new { error = "This project still has related data (such as API keys). Remove it before deleting the project." });
        }
    }

    [HttpGet("{id:guid}/members")]
    public async Task<ActionResult<IReadOnlyList<ProjectMemberDto>>> GetMembers(
        Guid id,
        CancellationToken cancellationToken)
    {
        var project = await repository.FindAsync(id, cancellationToken);
        if (project is null)
            return NotFound();
        return project.Members.Select(ProjectDtoMapper.ToMemberDto).ToArray();
    }

    [HttpPost("{id:guid}/members/{userId:guid}")]
    [Authorize(Roles = nameof(UserRole.Admin))]
    public async Task<ActionResult<ProjectDto>> AddMember(
        Guid id,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var project = await repository.FindAsync(id, cancellationToken);
        if (project is null)
            return NotFound();
        var user = await userRepository.FindAsync(userId, cancellationToken);
        if (user is null)
            return BadRequest($"User {userId} not found.");

        if (project.Members.Any(m => m.Id == userId))
            return ToDto(project);

        var members = project.Members.Append(user).ToArray();
        var updated = createExisting(project.Name, project.SystemEndpoint, members, project);
        var saved = await repository.UpdateAsync(updated, cancellationToken);
        return ToDto(saved);
    }

    [HttpDelete("{id:guid}/members/{userId:guid}")]
    [Authorize(Roles = nameof(UserRole.Admin))]
    public async Task<ActionResult<ProjectDto>> RemoveMember(
        Guid id,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var project = await repository.FindAsync(id, cancellationToken);
        if (project is null)
            return NotFound();

        if (project.Members.All(m => m.Id != userId))
            return ToDto(project);

        var members = project.Members.Where(m => m.Id != userId).ToArray();
        var updated = createExisting(project.Name, project.SystemEndpoint, members, project);
        var saved = await repository.UpdateAsync(updated, cancellationToken);
        return ToDto(saved);
    }

    private async Task<IReadOnlyCollection<IUser>?> ResolveMembersAsync(
        IReadOnlyList<Guid>? memberIds,
        CancellationToken cancellationToken)
    {
        if (memberIds is null || memberIds.Count == 0)
            return [];

        var distinct = memberIds.Distinct().ToArray();
        foreach (var userId in distinct)
        {
            if (!await userRepository.ContainsAsync(userId, cancellationToken))
                return null;
        }
        return await userRepository.GetManyAsync(distinct, cancellationToken);
    }

    private static ProjectDto ToDto(IProject p) => ProjectDtoMapper.ToDto(p);
}
