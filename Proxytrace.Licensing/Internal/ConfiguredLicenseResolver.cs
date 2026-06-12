using Microsoft.Extensions.Logging;
using Proxytrace.Licensing.Exceptions;

namespace Proxytrace.Licensing.Internal;

/// <summary>
/// Resolves the license snapshot from the static configuration (override snapshot, environment
/// JWT, or nothing). An invalid configured JWT never throws — it degrades to Free-tier
/// entitlements with <see cref="LicenseStatus.Invalid"/> so the host always boots; a stored
/// license set at runtime can then replace it.
/// </summary>
internal sealed class ConfiguredLicenseResolver
{
    private readonly LicensingConfiguration configuration;
    private readonly IJwtLicenseValidator validator;
    private readonly ILogger<ConfiguredLicenseResolver> logger;

    public ConfiguredLicenseResolver(
        LicensingConfiguration configuration,
        IJwtLicenseValidator validator,
        ILogger<ConfiguredLicenseResolver> logger)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        ArgumentNullException.ThrowIfNull(validator);
        this.configuration = configuration;
        this.validator = validator;
        this.logger = logger;
    }

    public LicenseSnapshot Resolve()
    {
        if (configuration.OverrideSnapshot is { } overrideSnapshot)
        {
            logger.LogInformation(
                "License override active: tier {Tier} (no online verification)",
                overrideSnapshot.Tier);
            return overrideSnapshot;
        }

        var jwt = configuration.LicenseJwt?.Trim();
        if (string.IsNullOrEmpty(jwt))
        {
            logger.LogInformation("No license configured; running in Free tier");
            return LicenseSnapshot.Free();
        }

        try
        {
            var snapshot = validator.Validate(jwt) with { Source = LicenseSource.Environment };
            logger.LogInformation(
                "License validated: tier {Tier}, customer {Customer}",
                snapshot.Tier,
                snapshot.CustomerEmail);
            return snapshot;
        }
        catch (InvalidLicenseException ex)
        {
            logger.LogWarning(
                ex,
                "The configured license is invalid ({Reason}); running with Free-tier entitlements until it is corrected",
                ex.Reason);
            return LicenseSnapshot.Invalid(LicenseSource.Environment, ex.Message);
        }
    }
}
