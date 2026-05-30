namespace Proxytrace.Licensing;

/// <summary>
/// An immutable point-in-time view of the resolved license: tier, status, validity window,
/// and the effective features and limits in force.
/// </summary>
public sealed record LicenseSnapshot(
    LicenseTier Tier,
    LicenseStatus Status,
    DateTimeOffset? ExpiresAt,
    DateTimeOffset? GracePeriodEndsAt,
    string? CustomerEmail,
    string? Jti,
    IReadOnlySet<LicenseFeature> Features,
    IReadOnlyDictionary<LicenseLimit, long> Limits)
{
    /// <summary>
    /// Builds the default Free-tier snapshot used when no license JWT is configured.
    /// </summary>
    public static LicenseSnapshot Free()
    {
        var definition = LicensePolicy.For(LicenseTier.Free);
        return new LicenseSnapshot(
            LicenseTier.Free,
            LicenseStatus.Free,
            ExpiresAt: null,
            GracePeriodEndsAt: null,
            CustomerEmail: null,
            Jti: null,
            definition.Features,
            definition.Limits);
    }
}
