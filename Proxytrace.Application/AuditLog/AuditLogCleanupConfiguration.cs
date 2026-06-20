namespace Proxytrace.Application.AuditLog;

/// <summary>
/// Retention settings for the audit log. Bound from the <c>AuditLogCleanup</c> configuration section;
/// defaults apply when unconfigured (tests, kiosk). The audit log is lossless — there is no count cap,
/// only age-based retention with a long default suited to compliance.
/// </summary>
public sealed record AuditLogCleanupConfiguration
{
    /// <summary>Age-based retention: entries older than this are removed.</summary>
    public int RetentionDurationDays { get; init; } = 365;

    /// <summary>How often the retention pass runs.</summary>
    public int CleanupIntervalHours { get; init; } = 24;
}
