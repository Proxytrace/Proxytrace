namespace Proxytrace.Licensing;

/// <summary>
/// An immutable point-in-time view of the resolved license: tier, status, validity window,
/// the effective features and limits in force, and where the license came from.
/// </summary>
/// <param name="Offline">
/// True when the license JWT carries the <c>offline: true</c> claim — an air-gapped,
/// server-check-exempt key. For these the background service never contacts the license
/// server (so they cannot be revoked); <see cref="ExpiresAt"/> is the only thing that ends
/// them. Absent / non-<c>true</c> claim ⇒ false (a normal online license).
/// </param>
public sealed record LicenseSnapshot(
    LicenseTier Tier,
    LicenseStatus Status,
    DateTimeOffset? ExpiresAt,
    DateTimeOffset? GracePeriodEndsAt,
    string? CustomerEmail,
    string? Jti,
    IReadOnlySet<LicenseFeature> Features,
    IReadOnlyDictionary<LicenseLimit, long> Limits,
    LicenseSource Source = LicenseSource.None,
    string? InvalidReason = null,
    bool Offline = false)
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

    /// <summary>
    /// Builds the snapshot used when a configured license fails validation: Free-tier
    /// entitlements with <see cref="LicenseStatus.Invalid"/> and the rejection reason, so the
    /// deployment keeps running while the UI can surface the problem.
    /// </summary>
    public static LicenseSnapshot Invalid(LicenseSource source, string reason)
        => Free() with
        {
            Status = LicenseStatus.Invalid,
            Source = source,
            InvalidReason = reason,
        };

    /// <summary>
    /// Builds an active, perpetual Enterprise-tier snapshot with no JWT identity. Because
    /// <see cref="Jti"/> is null, the background check service never re-verifies or degrades it.
    /// Used by kiosk/demo deployments to showcase the full feature set without a signed license.
    /// </summary>
    public static LicenseSnapshot Enterprise(string? customerEmail = null)
    {
        var definition = LicensePolicy.For(LicenseTier.Enterprise);
        return new LicenseSnapshot(
            LicenseTier.Enterprise,
            LicenseStatus.Active,
            ExpiresAt: null,
            GracePeriodEndsAt: null,
            CustomerEmail: customerEmail,
            Jti: null,
            definition.Features,
            definition.Limits,
            LicenseSource.Override);
    }
}
