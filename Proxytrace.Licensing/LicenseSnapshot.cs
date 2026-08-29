namespace Proxytrace.Licensing;

/// <summary>
/// An immutable point-in-time view of the resolved support key: tier, status, validity window,
/// and where the key came from. Every feature of Proxytrace is available regardless of the
/// snapshot — the license key only records whether the deployment holds an Enterprise support
/// contract.
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
    LicenseSource Source = LicenseSource.None,
    string? InvalidReason = null,
    bool Offline = false)
{
    /// <summary>
    /// Builds the default snapshot used when no support key is configured.
    /// </summary>
    public static LicenseSnapshot Free() => new(
        LicenseTier.Free,
        LicenseStatus.Free,
        ExpiresAt: null,
        GracePeriodEndsAt: null,
        CustomerEmail: null,
        Jti: null);

    /// <summary>
    /// Builds the snapshot used when a configured key fails validation: Free tier with
    /// <see cref="LicenseStatus.Invalid"/> and the rejection reason, so the deployment keeps
    /// running while the UI can surface the problem.
    /// </summary>
    public static LicenseSnapshot Invalid(LicenseSource source, string reason)
        => Free() with
        {
            Status = LicenseStatus.Invalid,
            Source = source,
            InvalidReason = reason,
        };
}
