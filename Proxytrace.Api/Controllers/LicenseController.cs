using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Proxytrace.Api.Dto.License;
using Proxytrace.Application.Ingestion;
using Proxytrace.Domain.User;
using Proxytrace.Licensing;

namespace Proxytrace.Api.Controllers;

[ApiController]
[Route("api/license")]
public class LicenseController : ControllerBase
{
    private readonly ILicenseService licenseService;
    private readonly ITraceQuotaGuard quotaGuard;

    public LicenseController(ILicenseService licenseService, ITraceQuotaGuard quotaGuard)
    {
        this.licenseService = licenseService;
        this.quotaGuard = quotaGuard;
    }

    [HttpGet]
    [AllowAnonymous]
    public LicenseDto Get() => Map(licenseService.Current);

    [HttpPost("refresh")]
    [Authorize(Roles = nameof(UserRole.Admin))]
    public async Task<LicenseDto> Refresh(CancellationToken cancellationToken)
    {
        await licenseService.ForceRefreshAsync(cancellationToken);
        return Map(licenseService.Current);
    }

    private LicenseDto Map(LicenseSnapshot snapshot) => new(
        Tier: snapshot.Tier.ToString().ToLowerInvariant(),
        Status: snapshot.Status.ToString().ToLowerInvariant(),
        ExpiresAt: snapshot.ExpiresAt,
        GracePeriodEndsAt: snapshot.GracePeriodEndsAt,
        CustomerEmail: snapshot.CustomerEmail,
        Features: snapshot.Features.Select(f => f.ToString()).ToArray(),
        Limits: snapshot.Limits.ToDictionary(kvp => kvp.Key.ToString(), kvp => kvp.Value),
        QuotaExceeded: quotaGuard.IsCurrentMonthOverQuota);
}
