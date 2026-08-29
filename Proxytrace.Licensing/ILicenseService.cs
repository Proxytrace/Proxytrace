namespace Proxytrace.Licensing;

/// <summary>
/// Provides the current resolved support key. The single source of truth for license state
/// across the application. Nothing is gated on it — every feature is always available; the
/// key only signals an Enterprise support contract.
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
    /// Forces an immediate license server check, updating <see cref="Current"/> if it changed.
    /// </summary>
    Task ForceRefreshAsync(CancellationToken cancellationToken = default);
}
