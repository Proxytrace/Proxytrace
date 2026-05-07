using Microsoft.AspNetCore.Mvc;
using Trsr.Api.Dto;
using Trsr.Api.Dto.Projects;
using Trsr.Domain;
using Trsr.Domain.ModelEndpoint;
using Trsr.Domain.Project;

namespace Trsr.Api.Controllers;

[ApiController]
[Route("api/projects")]
public class ProjectsController : ControllerBase
{
    private readonly IProjectRepository repository;
    private readonly IRepository<IModelEndpoint> endpointRepository;
    private readonly IProject.CreateNew createNew;
    private readonly IProject.CreateExisting createExisting;

    public ProjectsController(
        IProjectRepository repository,
        IRepository<IModelEndpoint> endpointRepository,
        IProject.CreateNew createNew,
        IProject.CreateExisting createExisting)
    {
        this.repository = repository;
        this.endpointRepository = endpointRepository;
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
        var project = createNew(request.Name, endpoint);
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

        var updated = createExisting(request.Name, endpoint, existing);
        var saved = await repository.UpdateAsync(updated, cancellationToken);
        return ToDto(saved);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var removed = await repository.RemoveAsync(id, cancellationToken);
        return removed ? NoContent() : NotFound();
    }

    private static ProjectDto ToDto(IProject p) =>
        new(p.Id, p.Name, p.CreatedAt, p.UpdatedAt);
}
