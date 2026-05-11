using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Trsr.Api.Dto;
using Trsr.Api.Dto.Projects;
using Trsr.Domain;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Project;
using Trsr.Domain.User;

namespace Trsr.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/projects")]
public class ProjectsController : ControllerBase
{
    private readonly IProjectRepository repository;
    private readonly IRepository<IModelEndpoint> endpointRepository;
    private readonly IRepository<IUser> userRepository;
    private readonly IProject.CreateNew createNew;
    private readonly IProject.CreateExisting createExisting;

    public ProjectsController(
        IProjectRepository repository,
        IRepository<IModelEndpoint> endpointRepository,
        IRepository<IUser> userRepository,
        IProject.CreateNew createNew,
        IProject.CreateExisting createExisting)
    {
        this.repository = repository;
        this.endpointRepository = endpointRepository;
        this.userRepository = userRepository;
        this.createNew = createNew;
        this.createExisting = createExisting;
    }

    [HttpGet]
    public async Task<PagedResult<ProjectDto>> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var all = await repository.GetAllAsync(cancellationToken);
        var items = all.Skip((page - 1) * pageSize).Take(pageSize).Select(ToDto).ToArray();
        return new PagedResult<ProjectDto>(items, all.Count, page, pageSize);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ProjectDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        if (!await repository.ContainsAsync(id, cancellationToken))
            return NotFound();
        var project = await repository.GetAsync(id, cancellationToken);
        return ToDto(project);
    }

    [HttpPost]
    public async Task<ActionResult<ProjectDto>> Create(
        [FromBody] CreateProjectRequest request,
        CancellationToken cancellationToken)
    {
        if (!await endpointRepository.ContainsAsync(request.SystemEndpointId, cancellationToken))
            return BadRequest($"SystemEndpoint {request.SystemEndpointId} not found.");
        var endpoint = await endpointRepository.GetAsync(request.SystemEndpointId, cancellationToken);

        var members = await ResolveMembersAsync(request.MemberIds, cancellationToken);
        if (members is null)
            return BadRequest("One or more memberIds reference unknown users.");

        var project = createNew(request.Name, endpoint, members);
        var saved = await repository.AddAsync(project, cancellationToken);
        return CreatedAtAction(nameof(Get), new { id = saved.Id }, ToDto(saved));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ProjectDto>> Update(
        Guid id,
        [FromBody] UpdateProjectRequest request,
        CancellationToken cancellationToken)
    {
        if (!await repository.ContainsAsync(id, cancellationToken))
            return NotFound();
        var existing = await repository.GetAsync(id, cancellationToken);
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
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var removed = await repository.RemoveAsync(id, cancellationToken);
        return removed ? NoContent() : NotFound();
    }

    [HttpGet("{id:guid}/members")]
    public async Task<ActionResult<IReadOnlyList<ProjectMemberDto>>> GetMembers(
        Guid id,
        CancellationToken cancellationToken)
    {
        if (!await repository.ContainsAsync(id, cancellationToken))
            return NotFound();
        var project = await repository.GetAsync(id, cancellationToken);
        return project.Members.Select(ToMemberDto).ToArray();
    }

    [HttpPost("{id:guid}/members/{userId:guid}")]
    public async Task<ActionResult<ProjectDto>> AddMember(
        Guid id,
        Guid userId,
        CancellationToken cancellationToken)
    {
        if (!await repository.ContainsAsync(id, cancellationToken))
            return NotFound();
        if (!await userRepository.ContainsAsync(userId, cancellationToken))
            return BadRequest($"User {userId} not found.");

        var project = await repository.GetAsync(id, cancellationToken);
        if (project.Members.Any(m => m.Id == userId))
            return ToDto(project);

        var user = await userRepository.GetAsync(userId, cancellationToken);
        var members = project.Members.Append(user).ToArray();
        var updated = createExisting(project.Name, project.SystemEndpoint, members, project);
        var saved = await repository.UpdateAsync(updated, cancellationToken);
        return ToDto(saved);
    }

    [HttpDelete("{id:guid}/members/{userId:guid}")]
    public async Task<ActionResult<ProjectDto>> RemoveMember(
        Guid id,
        Guid userId,
        CancellationToken cancellationToken)
    {
        if (!await repository.ContainsAsync(id, cancellationToken))
            return NotFound();

        var project = await repository.GetAsync(id, cancellationToken);
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
            return Array.Empty<IUser>();

        var distinct = memberIds.Distinct().ToArray();
        foreach (var userId in distinct)
        {
            if (!await userRepository.ContainsAsync(userId, cancellationToken))
                return null;
        }
        return await userRepository.GetManyAsync(distinct, cancellationToken);
    }

    private static ProjectDto ToDto(IProject p) =>
        new(p.Id,
            p.Name,
            p.SystemEndpoint.Id,
            p.Members.Select(ToMemberDto).ToArray(),
            p.CreatedAt,
            p.UpdatedAt);

    private static ProjectMemberDto ToMemberDto(IUser user) =>
        new(user.Id, user.Email);
}
