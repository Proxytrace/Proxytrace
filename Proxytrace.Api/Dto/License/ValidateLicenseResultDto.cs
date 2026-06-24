namespace Proxytrace.Api.Dto.License;

/// <summary>
/// Outcome of a stateless license key validation: whether the key is acceptable and, when it
/// is, a preview of what it would activate.
/// </summary>
public sealed record ValidateLicenseResultDto(
    bool Valid,
    string? Reason,
    string? Tier,
    DateTimeOffset? ExpiresAt,
    string? CustomerEmail,
    bool Offline);
