using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Proxytrace.Api.Dto.License;
using Proxytrace.Application.Licensing;
using Proxytrace.Application.Setup;
using Proxytrace.Domain.AuditLog;
using Proxytrace.Domain.User;
using Proxytrace.Licensing;
using Proxytrace.Licensing.Exceptions;

namespace Proxytrace.Api.Controllers;

/// <summary>
/// API controller for the Enterprise support key. The key has no functional effect — every
/// feature is always available — it only records whether a support contract is on file.
/// </summary>
[ApiController]
[Route("api/license")]
public class LicenseController : ControllerBase
{
    private readonly ILicenseService licenseService;
    private readonly ILicenseKeyManager keyManager;
    private readonly ISetupService setup;
    private readonly ILogger<Audit> audit;

    /// <summary>
    /// Initializes a new instance of the <see cref="LicenseController"/> class.
    /// </summary>
    public LicenseController(
        ILicenseService licenseService,
        ILicenseKeyManager keyManager,
        ISetupService setup,
        ILogger<Audit> audit)
    {
        this.licenseService = licenseService;
        this.keyManager = keyManager;
        this.setup = setup;
        this.audit = audit;
    }

    /// <summary>
    /// The current support key. Anonymous by design — the login screen renders the support badge
    /// before any user exists — but the licensee's identity is withheld from unauthenticated
    /// callers: without that, <c>curl https://host/api/license</c> from the internet discloses the
    /// purchaser's email address. Signed-in callers (the Settings → License panel) still see it.
    /// </summary>
    [HttpGet]
    [AllowAnonymous]
    public LicenseDto Get()
    {
        LicenseDto dto = Map(licenseService.Current);
        return User.Identity?.IsAuthenticated == true
            ? dto
            : dto with { CustomerEmail = null };
    }

    /// <summary>
    /// Validates a license key without storing or applying it. Anonymous by design: it is a
    /// pure offline JWT verification and the setup wizard runs before any user exists.
    /// </summary>
    [HttpPost("validate")]
    [AllowAnonymous]
    public ValidateLicenseResultDto Validate([FromBody] SetLicenseRequest request)
    {
        try
        {
            var snapshot = keyManager.Validate(request.License);
            return new ValidateLicenseResultDto(
                Valid: true,
                Reason: null,
                Tier: snapshot.Tier.ToString().ToLowerInvariant(),
                ExpiresAt: snapshot.ExpiresAt,
                CustomerEmail: snapshot.CustomerEmail,
                Offline: snapshot.Offline);
        }
        catch (InvalidLicenseException ex)
        {
            return new ValidateLicenseResultDto(
                Valid: false,
                Reason: ex.Message,
                Tier: null,
                ExpiresAt: null,
                CustomerEmail: null,
                Offline: false);
        }
    }

    /// <summary>
    /// Sets the installation's support key. Admin-only once users exist; anonymous while setup
    /// is incomplete (no users yet) so a key can be applied before the first admin exists —
    /// the same gate as first-admin creation.
    /// </summary>
    [HttpPut]
    [AllowAnonymous]
    public async Task<ActionResult<LicenseDto>> Set(
        [FromBody] SetLicenseRequest request,
        CancellationToken cancellationToken)
    {
        if (!await CanManageAsync(cancellationToken))
            return Forbid();

        // An invalid key throws InvalidLicenseException → 422 via the exception mapper.
        await keyManager.SetAsync(request.License, cancellationToken);

        var current = licenseService.Current;
        audit.LogAudit(
            AuditAction.LicenseSet,
            targetType: "License",
            targetLabel: current.Tier.ToString(),
            details: JsonSerializer.Serialize(new { tier = current.Tier.ToString(), customerEmail = current.CustomerEmail }));
        return Map(current);
    }

    /// <summary>
    /// Removes the stored support key; the installation falls back to the environment-supplied
    /// key, or to no support contract when none is configured.
    /// </summary>
    [HttpDelete]
    [Authorize(Roles = nameof(UserRole.Admin))]
    public async Task<ActionResult<LicenseDto>> Remove(CancellationToken cancellationToken)
    {
        await keyManager.RemoveAsync(cancellationToken);
        audit.LogAudit(AuditAction.LicenseRemoved, targetType: "License");
        return Map(licenseService.Current);
    }

    /// <summary>
    /// Refreshes.
    /// </summary>
    [HttpPost("refresh")]
    [Authorize(Roles = nameof(UserRole.Admin))]
    public async Task<LicenseDto> Refresh(CancellationToken cancellationToken)
    {
        await licenseService.ForceRefreshAsync(cancellationToken);
        return Map(licenseService.Current);
    }

    private async Task<bool> CanManageAsync(CancellationToken cancellationToken)
        => User.IsInRole(nameof(UserRole.Admin))
           || !await setup.AnyUsersExistAsync(cancellationToken);

    private LicenseDto Map(LicenseSnapshot snapshot) => new(
        Tier: snapshot.Tier.ToString().ToLowerInvariant(),
        Status: snapshot.Status.ToString().ToLowerInvariant(),
        Source: snapshot.Source.ToString().ToLowerInvariant(),
        InvalidReason: snapshot.InvalidReason,
        ExpiresAt: snapshot.ExpiresAt,
        GracePeriodEndsAt: snapshot.GracePeriodEndsAt,
        CustomerEmail: snapshot.CustomerEmail,
        Offline: snapshot.Offline);
}
