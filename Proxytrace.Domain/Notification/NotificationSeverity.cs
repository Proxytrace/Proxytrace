namespace Proxytrace.Domain.Notification;

/// <summary>
/// Relative urgency of a <see cref="INotification"/>, used to colour and order it in the UI.
/// </summary>
public enum NotificationSeverity
{
    /// <summary>Informational; no action required.</summary>
    Info,

    /// <summary>A degradation worth attention (e.g. pass-rate drop, latency increase).</summary>
    Warning,

    /// <summary>A hard failure demanding attention (e.g. a test run failed / endpoint unavailable).</summary>
    Critical,
}
