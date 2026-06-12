using Proxytrace.Licensing;
using Proxytrace.Licensing.Exceptions;

namespace Proxytrace.Application.Licensing;

/// <summary>
/// Manages the runtime-set license key: validation, persistence, and activation without a
/// restart. A stored license takes precedence over an environment-supplied one; removing it
/// falls back to the environment license (or Free).
/// </summary>
public interface ILicenseKeyManager
{
    /// <summary>
    /// Validates a license JWT without storing or applying it. Throws
    /// <see cref="InvalidLicenseException"/> when rejected; returns the snapshot the license
    /// would activate.
    /// </summary>
    LicenseSnapshot Validate(string licenseJwt);

    /// <summary>
    /// Validates, persists, and activates a license JWT. Throws
    /// <see cref="InvalidLicenseException"/> when rejected (nothing is stored and the current
    /// license is kept).
    /// </summary>
    Task<LicenseSnapshot> SetAsync(string licenseJwt, CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes the stored license (if any) and re-activates the environment-configured license,
    /// or Free when none is configured.
    /// </summary>
    Task<LicenseSnapshot> RemoveAsync(CancellationToken cancellationToken = default);
}
