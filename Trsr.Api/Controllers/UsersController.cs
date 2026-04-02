using Microsoft.AspNetCore.Mvc;
using Trsr.Api.Dto;
using Trsr.Api.Dto.Users;
using Trsr.Domain;
using Trsr.Domain.User;

namespace Trsr.Api.Controllers;

[ApiController]
[Route("api/users")]
public class UsersController : ControllerBase
{
    private readonly IRepository<IUser> repository;
    private readonly IUser.CreateNew createNew;
    private readonly IUser.CreateExisting createExisting;

    public UsersController(
        IRepository<IUser> repository,
        IUser.CreateNew createNew,
        IUser.CreateExisting createExisting)
    {
        this.repository = repository;
        this.createNew = createNew;
        this.createExisting = createExisting;
    }

    [HttpGet]
    public async Task<PagedResult<UserDto>> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var all = await repository.GetAllAsync(cancellationToken);
        var items = all.Skip((page - 1) * pageSize).Take(pageSize).Select(ToDto).ToArray();
        return new PagedResult<UserDto>(items, all.Count, page, pageSize);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<UserDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        if (!await repository.ContainsAsync(id, cancellationToken))
            return NotFound();
        var user = await repository.GetAsync(id, cancellationToken);
        return ToDto(user);
    }

    [HttpPost]
    public async Task<ActionResult<UserDto>> Create(
        [FromBody] CreateUserRequest request,
        CancellationToken cancellationToken)
    {
        var user = createNew(request.Name);
        var saved = await repository.AddAsync(user, cancellationToken);
        return CreatedAtAction(nameof(Get), new { id = saved.Id }, ToDto(saved));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<UserDto>> Update(
        Guid id,
        [FromBody] UpdateUserRequest request,
        CancellationToken cancellationToken)
    {
        if (!await repository.ContainsAsync(id, cancellationToken))
            return NotFound();
        var existing = await repository.GetAsync(id, cancellationToken);
        var updated = createExisting(request.Name, existing);
        var saved = await repository.UpdateAsync(updated, cancellationToken);
        return ToDto(saved);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var removed = await repository.RemoveAsync(id, cancellationToken);
        return removed ? NoContent() : NotFound();
    }

    private static UserDto ToDto(IUser u) => new(u.Id, u.Name, u.CreatedAt, u.UpdatedAt);
}
