using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Trsr.Api.Dto;
using Trsr.Api.Dto.Users;
using Trsr.Application.Auth;
using Trsr.Domain;
using Trsr.Domain.User;

namespace Trsr.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/users")]
public class UsersController : ControllerBase
{
    private readonly IRepository<IUser> repository;
    private readonly ICurrentUserAccessor currentUser;

    public UsersController(
        IRepository<IUser> repository,
        ICurrentUserAccessor currentUser)
    {
        this.repository = repository;
        this.currentUser = currentUser;
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

    [HttpGet("me")]
    public async Task<ActionResult<UserDto>> Me(CancellationToken cancellationToken)
    {
        var user = await currentUser.GetCurrentUserAsync(cancellationToken);
        return user is null ? Unauthorized() : ToDto(user);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<UserDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        if (!await repository.ContainsAsync(id, cancellationToken))
            return NotFound();
        var user = await repository.GetAsync(id, cancellationToken);
        return ToDto(user);
    }

    [HttpPut("{id:guid}/role")]
    [Authorize(Roles = nameof(UserRole.Admin))]
    public async Task<ActionResult<UserDto>> UpdateRole(
        Guid id,
        [FromBody] UpdateUserRoleRequest request,
        CancellationToken cancellationToken)
    {
        if (!await repository.ContainsAsync(id, cancellationToken))
            return NotFound();
        var user = await repository.GetAsync(id, cancellationToken);
        var updated = await user.ChangeRole(request.Role, cancellationToken);
        return ToDto(updated);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = nameof(UserRole.Admin))]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var removed = await repository.RemoveAsync(id, cancellationToken);
        return removed ? NoContent() : NotFound();
    }

    private static UserDto ToDto(IUser u) =>
        new(u.Id, u.Email, u.Role, u.CreatedAt, u.UpdatedAt);
}
