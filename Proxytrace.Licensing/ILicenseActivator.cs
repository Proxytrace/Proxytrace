using Proxytrace.Licensing.Exceptions;

namespace Proxytrace.Licensing;

/// <summary>
/// Runtime license management: validates license JWTs and swaps the active
/// <see cref="LicenseSnapshot"/> without a restart. Persistence of a runtime-set license lives
/// in the application layer; this interface only covers validation and activation.
/// </summary>
public interface ILicenseActivator
{
    /// <summary>
    /// Validates a license JWT without applying it. Throws <see cref="InvalidLicenseException"/>
    /// when the JWT is rejected; returns the snapshot the license would activate.
    /// </summary>
    LicenseSnapshot Validate(string licenseJwt);

    /// <summary>
    /// Validates a license JWT and makes it the active license. Throws
    /// <see cref="InvalidLicenseException"/> when the JWT is rejected (the current license is
    /// kept).
    /// </summary>
    LicenseSnapshot Activate(string licenseJwt, LicenseSource source);

    /// <summary>
    /// Like <see cref="Activate"/>, but never throws: a rejected JWT activates a Free-tier
    /// snapshot with <see cref="LicenseStatus.Invalid"/> and the rejection reason instead. Used
    /// when applying a previously accepted license (e.g. the stored one at startup) that may
    /// have expired since.
    /// </summary>
    LicenseSnapshot ActivateOrInvalid(string licenseJwt, LicenseSource source);

    /// <summary>
    /// Re-resolves the license from static configuration (override snapshot, environment JWT,
    /// or Free) and makes it active. Used when a stored license is removed. Never throws — an
    /// invalid configured JWT yields <see cref="LicenseStatus.Invalid"/> with Free entitlements.
    /// </summary>
    LicenseSnapshot ActivateConfigured();
}
