namespace Proxytrace.Api.Dto.License;

/// <summary>
/// Client-facing view of the current support-key state.
/// </summary>
public sealed record LicenseDto(
    string Tier,
    string Status,
    string Source,
    string? InvalidReason,
    DateTimeOffset? ExpiresAt,
    DateTimeOffset? GracePeriodEndsAt,
    string? CustomerEmail,
    bool Offline);
