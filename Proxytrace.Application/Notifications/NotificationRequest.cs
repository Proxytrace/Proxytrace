using Proxytrace.Domain.Notification;

namespace Proxytrace.Application.Notifications;

/// <summary>
/// An un-persisted notification intent. Fanned out by <see cref="INotificationService"/> to every
/// registered <see cref="INotificationChannel"/>. Decoupled from <see cref="INotification"/> so a
/// channel can deliver (e.g. send an email) without touching the database.
/// </summary>
public record NotificationRequest(
    NotificationKind Kind,
    NotificationSeverity Severity,
    string Title,
    string Message,
    Guid? ProjectId,
    NotificationTargetKind? TargetKind = null,
    Guid? TargetId = null);
