using Proxytrace.Domain.Notification;

namespace Proxytrace.Application.Notifications;

/// <summary>
/// An un-persisted notification intent — the producer-facing input to
/// <see cref="INotificationService.NotifyAsync"/>. The service de-duplicates it, turns it into a
/// persisted <see cref="INotification"/>, and hands that entity to every
/// <see cref="INotificationChannel"/>; producers never deal with ids or persistence.
/// </summary>
public record NotificationRequest(
    NotificationKind Kind,
    NotificationSeverity Severity,
    string Title,
    string Message,
    Guid? ProjectId,
    NotificationTargetKind? TargetKind = null,
    Guid? TargetId = null);
