using Microsoft.AspNetCore.Mvc;
using Trsr.Api.Dto.Setup;
using Trsr.Application.Cleanup;
using Trsr.Domain;
using Trsr.Domain.User;

namespace Trsr.Api.Controllers;

[ApiController]
[Route("api/setup")]
public class SetupController : ControllerBase
{
    private readonly IRepository<IUser> _users;
    private readonly IDataCleanupService _cleanup;

    public SetupController(IRepository<IUser> users, IDataCleanupService cleanup)
    {
        _users = users;
        _cleanup = cleanup;
    }

    [HttpGet("status")]
    public async Task<SetupStatusDto> GetStatus(CancellationToken cancellationToken)
    {
        var count = await _users.CountAsync(cancellationToken);
        return new SetupStatusDto { IsConfigured = count > 0 };
    }

    [HttpPost("cleanup")]
    public async Task<IActionResult> CleanupNonModelData(CancellationToken cancellationToken)
    {
        await _cleanup.DeleteAllNonModelDataAsync(cancellationToken);
        return NoContent();
    }
}
