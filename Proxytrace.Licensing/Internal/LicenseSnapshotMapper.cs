using Proxytrace.Licensing.Exceptions;
using Core = Nordstein.Core.Licensing;

namespace Proxytrace.Licensing.Internal;

/// <summary>
/// Maps between the Nordstein.Core licensing engine's string-keyed snapshot and Proxytrace's
/// enum-typed one. The engine resolves the tier through
/// <see cref="ProxytraceLicenseTierPolicy"/> before it reaches a snapshot, so the parse here
/// always succeeds; unknown tiers fall back to Free defensively. Proxytrace has no feature or
/// limit vocabulary, so the engine's entitlement sets are not carried over.
/// </summary>
internal static class LicenseSnapshotMapper
{
    /// <summary>
    /// To product.
    /// </summary>
    public static LicenseSnapshot ToProduct(Core.LicenseSnapshot snapshot)
    {
        var tier = Enum.TryParse<LicenseTier>(snapshot.Tier, ignoreCase: true, out var parsedTier)
            ? parsedTier
            : LicenseTier.Free;

        return new LicenseSnapshot(
            tier,
            ToProduct(snapshot.Status),
            snapshot.ExpiresAt,
            snapshot.GracePeriodEndsAt,
            snapshot.CustomerEmail,
            snapshot.Jti,
            ToProduct(snapshot.Source),
            snapshot.InvalidReason,
            snapshot.Offline);
    }

    /// <summary>
    /// To core.
    /// </summary>
    public static Core.LicenseSnapshot ToCore(LicenseSnapshot snapshot)
        => new(
            snapshot.Tier.ToString(),
            ToCore(snapshot.Status),
            snapshot.ExpiresAt,
            snapshot.GracePeriodEndsAt,
            snapshot.CustomerEmail,
            snapshot.Jti,
            new HashSet<string>(),
            new Dictionary<string, long>(),
            ToCore(snapshot.Source),
            snapshot.InvalidReason,
            snapshot.Offline);

    /// <summary>
    /// To product.
    /// </summary>
    public static LicenseStatus ToProduct(Core.LicenseStatus status) => status switch
    {
        Core.LicenseStatus.Free => LicenseStatus.Free,
        Core.LicenseStatus.Active => LicenseStatus.Active,
        Core.LicenseStatus.Grace => LicenseStatus.Grace,
        Core.LicenseStatus.Expired => LicenseStatus.Expired,
        Core.LicenseStatus.Invalid => LicenseStatus.Invalid,
        _ => LicenseStatus.Free,
    };

    /// <summary>
    /// To core.
    /// </summary>
    public static Core.LicenseStatus ToCore(LicenseStatus status) => status switch
    {
        LicenseStatus.Free => Core.LicenseStatus.Free,
        LicenseStatus.Active => Core.LicenseStatus.Active,
        LicenseStatus.Grace => Core.LicenseStatus.Grace,
        LicenseStatus.Expired => Core.LicenseStatus.Expired,
        LicenseStatus.Invalid => Core.LicenseStatus.Invalid,
        _ => Core.LicenseStatus.Free,
    };

    /// <summary>
    /// To product.
    /// </summary>
    public static LicenseSource ToProduct(Core.LicenseSource source) => source switch
    {
        Core.LicenseSource.None => LicenseSource.None,
        Core.LicenseSource.Environment => LicenseSource.Environment,
        Core.LicenseSource.Stored => LicenseSource.Stored,
        _ => LicenseSource.None,
    };

    /// <summary>
    /// To core.
    /// </summary>
    public static Core.LicenseSource ToCore(LicenseSource source) => source switch
    {
        LicenseSource.None => Core.LicenseSource.None,
        LicenseSource.Environment => Core.LicenseSource.Environment,
        LicenseSource.Stored => Core.LicenseSource.Stored,
        _ => Core.LicenseSource.None,
    };

    /// <summary>
    /// Rethrows the engine's rejection as Proxytrace's own exception type, preserving the
    /// reason, message, and cause, so downstream catch sites keep working unchanged.
    /// </summary>
    public static InvalidLicenseException ToProduct(Core.InvalidLicenseException exception)
        => new(ToProduct(exception.Reason), exception.Message, exception);

    /// <summary>
    /// To product.
    /// </summary>
    public static InvalidLicenseReason ToProduct(Core.InvalidLicenseReason reason) => reason switch
    {
        Core.InvalidLicenseReason.Malformed => InvalidLicenseReason.Malformed,
        Core.InvalidLicenseReason.BadSignature => InvalidLicenseReason.BadSignature,
        Core.InvalidLicenseReason.WrongIssuer => InvalidLicenseReason.WrongIssuer,
        Core.InvalidLicenseReason.WrongAudience => InvalidLicenseReason.WrongAudience,
        Core.InvalidLicenseReason.Expired => InvalidLicenseReason.Expired,
        Core.InvalidLicenseReason.MissingClaim => InvalidLicenseReason.MissingClaim,
        _ => InvalidLicenseReason.Malformed,
    };
}
