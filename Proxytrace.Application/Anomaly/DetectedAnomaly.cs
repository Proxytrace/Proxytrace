using Proxytrace.Domain.Notification;

namespace Proxytrace.Application.Anomaly;

/// <summary>
/// A negative anomaly found by <see cref="IAnomalyDetector"/>, ready to be raised as a
/// <see cref="Notifications.NotificationRequest"/>.
/// </summary>
public record DetectedAnomaly(
    NotificationSeverity Severity,
    string Title,
    string Message,
    NotificationTargetKind TargetKind,
    Guid TargetId);
