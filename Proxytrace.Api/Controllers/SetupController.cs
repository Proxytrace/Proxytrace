using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Proxytrace.Api.Dto.Setup;
using Proxytrace.Application.Cleanup;
using Proxytrace.Application.ErrorLog;
using Proxytrace.Application.Setup;
using Proxytrace.Common.Net;
using Proxytrace.Domain;
using Proxytrace.Domain.AuditLog;
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
    private readonly ILogger<Audit> audit;
    private readonly ILogger<SetupController> logger;
    private readonly IWebHostEnvironment env;

    public SetupController(
        IRepository<IUser> userRepository,
        IRepository<IProject> projectRepository,
        IDataCleanupService cleanup,
        ISetupService setup,
        ILogger<Audit> audit,
        ILogger<SetupController> logger,
        IWebHostEnvironment env)
    {
        this.userRepository = userRepository;
        this.projectRepository = projectRepository;
        this.cleanup = cleanup;
        this.setup = setup;
        this.audit = audit;
        this.logger = logger;
        this.env = env;
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
            request.ProviderEndpoint.ToEndpointUri(),
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
                request.ProviderEndpoint.ToEndpointUri(),
                request.ProviderUpstreamApiKey,
                request.ProviderKind);
            var ok = await setup.TestProviderConnectionAsync(input, cancellationToken);
            return new TestConnectionResponse(ok, ok ? null : "Connection failed.");
        }
        catch (Exception ex)
        {
            // Mirror ExceptionHandlingMiddleware: capture under an error id and only surface the raw
            // message in Development. Outside Development it may carry provider endpoint/credential or
            // other internal detail, so return a generic message carrying the error id for support.
            var errorId = Guid.NewGuid();
            using (logger.BeginScope(new Dictionary<string, object> { [ErrorLogScope.ErrorIdKey] = errorId }))
            {
                logger.LogError(ex, "Provider connection test failed");
            }

            var message = env.IsDevelopment()
                ? ex.Message
                : $"An unexpected error occurred. (Error ID: {errorId})";
            return new TestConnectionResponse(false, message);
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
            request.ProviderEndpoint.ToEndpointUri(),
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
        audit.LogAudit(AuditAction.SetupCleanupPurged, "Setup");
        return NoContent();
    }
}
