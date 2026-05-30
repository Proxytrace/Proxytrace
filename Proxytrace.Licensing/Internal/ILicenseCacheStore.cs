namespace Proxytrace.Licensing.Internal;

/// <summary>
/// The persisted record of the last successful license server check.
/// </summary>
internal sealed record LicenseCacheEntry(
    string? Jti,
    DateTimeOffset? LastServerOkUtc,
    string? LastServerStatus);

/// <summary>
/// Durable store for the last-known-good license check result, surviving restarts so the offline
/// grace window is measured correctly across process lifetimes.
/// </summary>
internal interface ILicenseCacheStore
{
    /// <summary>
    /// Loads the cached entry, or null when absent or corrupt.
    /// </summary>
    LicenseCacheEntry? Load();

    /// <summary>
    /// Persists the cached entry, tolerating filesystem failures.
    /// </summary>
    void Save(LicenseCacheEntry entry);
}
