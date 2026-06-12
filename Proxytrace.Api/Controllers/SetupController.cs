using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Proxytrace.Api.Dto.Setup;
using Proxytrace.Application.Cleanup;
using Proxytrace.Application.Setup;
using Proxytrace.Domain;
using Proxytrace.Domain.Project;
using Proxytrace.Domain.User;

namespace Proxytrace.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/setup")]
public class SetupController : ControllerBase
{
    private readonly IRepository<IUser> userRepository;
    private readonly IRepository<IProject> projectRepository;
    private readonly IDataCleanupService cleanup;
    private readonly ISetupService setup;

    public SetupController(
        IRepository<IUser> userRepository,
        IRepository<IProject> projectRepository,
        IDataCleanupService cleanup,
        ISetupService setup)
    {
        this.userRepository = userRepository;
        this.projectRepository = projectRepository;
        this.cleanup = cleanup;
        this.setup = setup;
    }

    [HttpGet("status")]
    [AllowAnonymous]
    public async Task<SetupStatusDto> GetStatus(CancellationToken cancellationToken)
    {
        var users = await this.userRepository.CountAsync(cancellationToken);
        var projects = await this.projectRepository.CountAsync(cancellationToken);
        return new SetupStatusDto { IsConfigured = users > 0 && projects > 0 };
    }

    [HttpPost("complete")]
    [Authorize(Roles = nameof(UserRole.Admin))]
    public async Task<ActionResult<CompleteSetupResponse>> Complete(
        [FromBody] CompleteSetupRequest request,
        CancellationToken cancellationToken)
    {
        if (await projectRepository.CountAsync(cancellationToken) > 0)
            return Conflict("Setup has already been completed.");

        var input = new SetupInput(
            request.ProviderName,
            new Uri(request.ProviderEndpoint),
            request.ProviderUpstreamApiKey,
            request.ProviderKind,
            request.ModelName,
            request.ProjectName);

        var result = await setup.CompleteAsync(input, cancellationToken);
        return new CompleteSetupResponse(
            result.ProviderId,
            result.EndpointId,
            result.ProjectId);
    }

    [HttpPost("test-connection")]
    [Authorize(Roles = nameof(UserRole.Admin))]
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
            var ok = await setup.TestProviderConnectionAsync(input, cancellationToken);
            return new TestConnectionResponse(ok, ok ? null : "Connection failed.");
        }
        catch (Exception ex)
        {
            return new TestConnectionResponse(false, ex.Message);
        }
    }

    [HttpPost("list-models")]
    [Authorize(Roles = nameof(UserRole.Admin))]
    public async Task<ListModelsResponse> ListModels(
        [FromBody] ListModelsRequest request,
        CancellationToken cancellationToken)
    {
        var input = new ProviderConnectionInput(
            request.ProviderName,
            new Uri(request.ProviderEndpoint),
            request.ProviderUpstreamApiKey,
            request.ProviderKind);
        var models = await setup.ListProviderModelsAsync(input, cancellationToken);
        return new ListModelsResponse(models);
    }

    [HttpPost("cleanup")]
    [Authorize(Roles = nameof(UserRole.Admin))]
    public async Task<IActionResult> CleanupNonModelData(CancellationToken cancellationToken)
    {
        await cleanup.DeleteAllNonModelDataAsync(cancellationToken);
        return NoContent();
    }
}
