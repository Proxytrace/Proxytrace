namespace Proxytrace.Api.Dto.Updates;

/// <summary>
/// Latest known update status as maintained by the daily background check.
/// </summary>
public sealed record UpdateStatusDto(
    string CurrentVersion,
    string? LatestVersion,
    bool UpdateAvailable,
    string? ReleaseUrl,
    DateTimeOffset? CheckedAt);
