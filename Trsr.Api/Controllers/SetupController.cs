using Microsoft.AspNetCore.Mvc;
using Trsr.Api.Dto.Setup;
using Trsr.Application.Cleanup;
using Trsr.Application.Setup;
using Trsr.Domain;
using Trsr.Domain.User;

namespace Trsr.Api.Controllers;

[ApiController]
[Route("api/setup")]
public class SetupController : ControllerBase
{
    private readonly IRepository<IUser> _users;
    private readonly IDataCleanupService _cleanup;
    private readonly ISetupService _setup;

    public SetupController(
        IRepository<IUser> users,
        IDataCleanupService cleanup,
        ISetupService setup)
    {
        _users = users;
        _cleanup = cleanup;
        _setup = setup;
    }

    [HttpGet("status")]
    public async Task<SetupStatusDto> GetStatus(CancellationToken cancellationToken)
    {
        var count = await _users.CountAsync(cancellationToken);
        return new SetupStatusDto { IsConfigured = count > 0 };
    }

    [HttpPost("complete")]
    public async Task<ActionResult<CompleteSetupResponse>> Complete(
        [FromBody] CompleteSetupRequest request,
        CancellationToken cancellationToken)
    {
        if (await _users.CountAsync(cancellationToken) > 0)
            return Conflict("Setup has already been completed.");

        var input = new SetupInput(
            request.UserName,
            request.ProviderName,
            new Uri(request.ProviderEndpoint),
            request.ProviderUpstreamApiKey,
            request.ProviderKind,
            request.ModelName,
            request.InputTokenCost,
            request.OutputTokenCost,
            request.ProjectName,
            request.ApiKeyName);

        var result = await _setup.CompleteAsync(input, cancellationToken);
        return new CompleteSetupResponse(
            result.UserId,
            result.ProviderId,
            result.EndpointId,
            result.ProjectId,
            result.ApiKeyValue);
    }

    [HttpPost("test-connection")]
    public async Task<TestConnectionResponse> TestConnection(
        [FromBody] TestConnectionRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var input = new ProviderConnectionInput(
                request.ProviderName,
                new Uri(request.ProviderEndpoint),
                request.ProviderUpstreamApiKey,
                request.ProviderKind);
            var ok = await _setup.TestProviderConnectionAsync(input, cancellationToken);
            return new TestConnectionResponse(ok, ok ? null : "Connection failed.");
        }
        catch (Exception ex)
        {
            return new TestConnectionResponse(false, ex.Message);
        }
    }

    [HttpPost("list-models")]
    public async Task<ListModelsResponse> ListModels(
        [FromBody] ListModelsRequest request,
        CancellationToken cancellationToken)
    {
        var input = new ProviderConnectionInput(
            request.ProviderName,
            new Uri(request.ProviderEndpoint),
            request.ProviderUpstreamApiKey,
            request.ProviderKind);
        var models = await _setup.ListProviderModelsAsync(input, cancellationToken);
        return new ListModelsResponse(models);
    }

    [HttpPost("cleanup")]
    public async Task<IActionResult> CleanupNonModelData(CancellationToken cancellationToken)
    {
        await _cleanup.DeleteAllNonModelDataAsync(cancellationToken);
        return NoContent();
    }
}
