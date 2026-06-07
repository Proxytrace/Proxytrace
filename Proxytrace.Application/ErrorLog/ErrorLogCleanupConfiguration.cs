namespace Proxytrace.Application.ErrorLog;

/// <summary>
/// Retention settings for captured application errors. Bound from the <c>ErrorLogCleanup</c>
/// configuration section; defaults apply when unconfigured (tests, kiosk).
/// </summary>
public sealed record ErrorLogCleanupConfiguration
{
    /// <summary>Age-based rotation: errors older than this are removed.</summary>
    public int RetentionDurationDays { get; init; } = 14;

    /// <summary>How often the cleanup pass runs.</summary>
    public int CleanupIntervalHours { get; init; } = 6;

    /// <summary>Hard count cap: at most this many newest errors are retained (error-storm guard).</summary>
    public int MaxRetained { get; init; } = 10000;
}
