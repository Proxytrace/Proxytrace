namespace Proxytrace.Licensing.Internal;

/// <summary>
/// The result of a license server revocation check.
/// </summary>
internal sealed record LicenseCheckResult(
    string Status,
    LicenseTier? UpdatedTier,
    IReadOnlyDictionary<LicenseLimit, long>? UpdatedLimits,
    DateTimeOffset CheckedAt)
{
    public const string Valid = "valid";
    public const string Revoked = "revoked";
    public const string Unknown = "unknown";
}

/// <summary>
/// Client for the upstream license server's revocation-check endpoint.
/// </summary>
internal interface ILicenseServerClient
{
    /// <summary>
    /// Asks the license server whether the license with the given jti is still valid.
    /// Network/transport failures surface as a "unknown" (transient) result, never an unhandled throw.
    /// </summary>
    Task<LicenseCheckResult> CheckAsync(string jti, string version, CancellationToken cancellationToken);
}
