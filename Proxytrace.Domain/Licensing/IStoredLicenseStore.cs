namespace Proxytrace.Domain.Licensing;

/// <summary>
/// Persistence for the runtime-set license JWT (set via the setup wizard or the settings UI).
/// At most one license is stored; it takes precedence over an environment-supplied license.
/// </summary>
public interface IStoredLicenseStore
{
    /// <summary>
    /// Returns the stored license JWT, or null when none has been set.
    /// </summary>
    Task<string?> GetAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Stores the license JWT, replacing any previously stored one.
    /// </summary>
    Task SaveAsync(string licenseJwt, CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes the stored license JWT, if any.
    /// </summary>
    Task RemoveAsync(CancellationToken cancellationToken = default);
}
