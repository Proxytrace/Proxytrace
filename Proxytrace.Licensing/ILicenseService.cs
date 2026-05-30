namespace Proxytrace.Licensing;

/// <summary>
/// Provides the current resolved license and answers feature/limit queries.
/// The single source of truth for licensing decisions across the application.
/// </summary>
public interface ILicenseService
{
    /// <summary>
    /// The current license snapshot. Never null; defaults to Free.
    /// </summary>
    LicenseSnapshot Current { get; }

    /// <summary>
    /// Raised whenever <see cref="Current"/> changes (e.g. a background check downgrades the tier).
    /// </summary>
    event Action Changed;

    /// <summary>
    /// Returns true when the given feature is granted by the current license.
    /// </summary>
    bool IsFeatureEnabled(LicenseFeature feature);

    /// <summary>
    /// Returns the effective value of the given limit; <see cref="long.MaxValue"/> means unlimited.
    /// </summary>
    long GetLimit(LicenseLimit limit);

    /// <summary>
    /// Forces an immediate license server check, updating <see cref="Current"/> if it changed.
    /// </summary>
    Task ForceRefreshAsync(CancellationToken cancellationToken = default);
}
