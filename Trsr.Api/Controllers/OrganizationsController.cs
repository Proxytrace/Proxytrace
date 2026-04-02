using Microsoft.AspNetCore.Mvc;
using Trsr.Api.Dto;
using Trsr.Api.Dto.Organizations;
using Trsr.Domain;
using Trsr.Domain.Organization;
using Trsr.Domain.User;

namespace Trsr.Api.Controllers;

[ApiController]
[Route("api/organizations")]
public class OrganizationsController : ControllerBase
{
    private readonly IOrganizationRepository repository;
    private readonly IRepository<IUser> userRepository;
    private readonly IOrganization.CreateNew createNew;
    private readonly IOrganization.CreateExisting createExisting;

    public OrganizationsController(
        IOrganizationRepository repository,
        IRepository<IUser> userRepository,
        IOrganization.CreateNew createNew,
        IOrganization.CreateExisting createExisting)
    {
        this.repository = repository;
        this.userRepository = userRepository;
        this.createNew = createNew;
        this.createExisting = createExisting;
    }

    [HttpGet]
    public async Task<PagedResult<OrganizationDto>> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var all = await repository.GetAllAsync(cancellationToken);
        var items = all.Skip((page - 1) * pageSize).Take(pageSize).Select(ToDto).ToArray();
        return new PagedResult<OrganizationDto>(items, all.Count, page, pageSize);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<OrganizationDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        if (!await repository.ContainsAsync(id, cancellationToken))
            return NotFound();
        var org = await repository.GetAsync(id, cancellationToken);
        return ToDto(org);
    }

    [HttpPost]
    public async Task<ActionResult<OrganizationDto>> Create(
        [FromBody] CreateOrganizationRequest request,
        CancellationToken cancellationToken)
    {
        var users = await userRepository.GetManyAsync(request.UserIds, cancellationToken);
        var org = createNew(request.Name, users);
        var saved = await repository.AddAsync(org, cancellationToken);
        return CreatedAtAction(nameof(Get), new { id = saved.Id }, ToDto(saved));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<OrganizationDto>> Update(
        Guid id,
        [FromBody] UpdateOrganizationRequest request,
        CancellationToken cancellationToken)
    {
        if (!await repository.ContainsAsync(id, cancellationToken))
            return NotFound();
        var existing = await repository.GetAsync(id, cancellationToken);
        var users = await userRepository.GetManyAsync(request.UserIds, cancellationToken);
        var updated = createExisting(request.Name, users, existing);
        var saved = await repository.UpdateAsync(updated, cancellationToken);
        return ToDto(saved);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var removed = await repository.RemoveAsync(id, cancellationToken);
        return removed ? NoContent() : NotFound();
    }

    private static OrganizationDto ToDto(IOrganization o) =>
        new(o.Id, o.Name, o.Users.Select(u => u.Id).ToArray(), o.CreatedAt, o.UpdatedAt);
}
