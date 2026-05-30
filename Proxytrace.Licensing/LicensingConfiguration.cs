namespace Proxytrace.Licensing;

/// <summary>
/// Configuration for the licensing subsystem, resolved by the composition root from
/// environment variables, embedded keys, and appsettings.
/// </summary>
public sealed record LicensingConfiguration
{
    /// <summary>
    /// Base URL of the upstream license server used for periodic revocation checks.
    /// </summary>
    public required string ServerUrl { get; init; }

    /// <summary>
    /// The base64 SPKI public keys accepted for verifying license JWT signatures.
    /// </summary>
    public required IReadOnlyList<string> PublicKeys { get; init; }

    /// <summary>
    /// The raw license JWT (from the environment), or null when running Free.
    /// </summary>
    public string? LicenseJwt { get; init; }

    /// <summary>
    /// How often the background check service contacts the license server.
    /// </summary>
    public int CheckIntervalHours { get; init; } = 24;

    /// <summary>
    /// How long an air-gapped/offline deployment may continue at full tier before
    /// degrading, when the license server is unreachable.
    /// </summary>
    public int OfflineGracePeriodDays { get; init; } = 7;

    /// <summary>
    /// Filesystem path where the last-known-good server check result is cached.
    /// </summary>
    public required string CacheFilePath { get; init; }
}
