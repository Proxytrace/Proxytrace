namespace Proxytrace.Application.Notifications;

/// <summary>
/// Single entry point for raising a notification. De-duplicates the request against active
/// notifications for the same target, persists it as an <c>INotification</c>, then fans that
/// entity out to every registered <see cref="INotificationChannel"/>.
/// </summary>
public interface INotificationService
{
    Task NotifyAsync(NotificationRequest request, CancellationToken cancellationToken = default);
}
