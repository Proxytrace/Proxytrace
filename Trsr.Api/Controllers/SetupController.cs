using Microsoft.AspNetCore.Mvc;
using Trsr.Api.Dto.Setup;
using Trsr.Domain;
using Trsr.Domain.User;

namespace Trsr.Api.Controllers;

[ApiController]
[Route("api/setup")]
public class SetupController : ControllerBase
{
    private readonly IRepository<IUser> _users;

    public SetupController(IRepository<IUser> users)
    {
        _users = users;
    }

    [HttpGet("status")]
    public async Task<SetupStatusDto> GetStatus(CancellationToken cancellationToken)
    {
        var count = await _users.CountAsync(cancellationToken);
        return new SetupStatusDto { IsConfigured = count > 0 };
    }
}
