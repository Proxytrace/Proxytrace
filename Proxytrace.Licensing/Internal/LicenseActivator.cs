using Microsoft.Extensions.Logging;
using Proxytrace.Licensing.Exceptions;

namespace Proxytrace.Licensing.Internal;

internal sealed class LicenseActivator : ILicenseActivator
{
    private readonly IJwtLicenseValidator validator;
    private readonly ConfiguredLicenseResolver resolver;
    private readonly LicenseService licenseService;
    private readonly ILogger<LicenseActivator> logger;

    public LicenseActivator(
        IJwtLicenseValidator validator,
        ConfiguredLicenseResolver resolver,
        LicenseService licenseService,
        ILogger<LicenseActivator> logger)
    {
        this.validator = validator;
        this.resolver = resolver;
        this.licenseService = licenseService;
        this.logger = logger;
    }

    public LicenseSnapshot Validate(string licenseJwt)
        => validator.Validate(licenseJwt);

    public LicenseSnapshot Activate(string licenseJwt, LicenseSource source)
    {
        var snapshot = validator.Validate(licenseJwt) with { Source = source };
        licenseService.ApplySnapshot(snapshot);
        logger.LogInformation(
            "License activated at runtime: tier {Tier}, customer {Customer}, source {Source}",
            snapshot.Tier,
            snapshot.CustomerEmail,
            source);
        return snapshot;
    }

    public LicenseSnapshot ActivateOrInvalid(string licenseJwt, LicenseSource source)
    {
        try
        {
            return Activate(licenseJwt, source);
        }
        catch (InvalidLicenseException ex)
        {
            logger.LogWarning(
                ex,
                "The {Source} license is invalid ({Reason}); running with Free-tier entitlements until it is corrected",
                source,
                ex.Reason);
            var snapshot = LicenseSnapshot.Invalid(source, ex.Message);
            licenseService.ApplySnapshot(snapshot);
            return snapshot;
        }
    }

    public LicenseSnapshot ActivateConfigured()
    {
        var snapshot = resolver.Resolve();
        licenseService.ApplySnapshot(snapshot);
        return snapshot;
    }
}
