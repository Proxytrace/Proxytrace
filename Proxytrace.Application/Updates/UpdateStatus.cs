namespace Proxytrace.Application.Updates;

/// <summary>
/// Snapshot of the latest known release relative to the running version. <c>CheckedAt</c> is
/// null until the first successful manifest fetch.
/// </summary>
public sealed record UpdateStatus(
    string CurrentVersion,
    string? LatestVersion,
    bool UpdateAvailable,
    string? ReleaseUrl,
    DateTimeOffset? CheckedAt);
